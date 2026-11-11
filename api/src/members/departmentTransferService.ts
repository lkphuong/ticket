import type { SessionData } from '../auth/sessionService.ts'
import type { DbDepartmentTransfer, DbMember, ITicketStore } from '../repositories/interfaces.ts'
import type { NotificationService } from '../notifications/notificationService.ts'

export const TRANSFER_NOTIFICATION_TYPES = {
  requested: 'department_transfer_requested',
  approved: 'department_transfer_approved',
  rejected: 'department_transfer_rejected',
} as const

const MAX_REJECT_REASON_LENGTH = 500

export class DepartmentTransferError extends Error {
  constructor(
    message: string,
    readonly httpStatus: 400 | 403 | 404 | 409,
    readonly code: 'ValidationError' | 'Forbidden' | 'NotFound' | 'Conflict',
  ) {
    super(message)
    this.name = 'DepartmentTransferError'
  }
}

type TransferNotifier = Pick<NotificationService, 'notifyMembers'>

// Moves staff between departments once the head of the department they leave has agreed
export class DepartmentTransferService {
  constructor(
    private readonly store: ITicketStore,
    private readonly notifier?: TransferNotifier,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Files a pending request for the viewer; only one request may wait at a time
  async requestTransfer(viewer: SessionData, toDepartmentRaw: unknown): Promise<DbDepartmentTransfer> {
    const member = await this.loadMember(viewer.userId)
    if (member.role !== 'staff') {
      throw new DepartmentTransferError('Chỉ nhân viên mới có thể xin luân chuyển phòng ban.', 403, 'Forbidden')
    }

    const toDepartment = typeof toDepartmentRaw === 'string' ? toDepartmentRaw.trim() : ''
    if (!toDepartment) {
      throw new DepartmentTransferError('Vui lòng chọn phòng ban muốn chuyển đến.', 400, 'ValidationError')
    }
    if (toDepartment === member.department) {
      throw new DepartmentTransferError('Bạn đang thuộc phòng ban này.', 400, 'ValidationError')
    }
    const departments = await this.store.departments.findAll()
    if (!departments.includes(toDepartment)) {
      throw new DepartmentTransferError(`Phòng ban "${toDepartment}" không tồn tại.`, 400, 'ValidationError')
    }
    if (await this.store.departmentTransfers.findPendingByMember(member.id)) {
      throw new DepartmentTransferError('Bạn đã có một yêu cầu luân chuyển đang chờ duyệt.', 409, 'Conflict')
    }

    const transfer: DbDepartmentTransfer = {
      id: crypto.randomUUID(),
      memberId: member.id,
      username: member.username,
      memberName: member.name,
      fromDepartment: member.department,
      toDepartment,
      status: 'pending',
      requestedAt: this.clock(),
    }
    await this.store.departmentTransfers.save(transfer)

    const head = await this.findHead(member.department)
    if (head) {
      await this.notifier?.notifyMembers(TRANSFER_NOTIFICATION_TYPES.requested, [
        {
          username: head.username,
          title: 'Có yêu cầu luân chuyển phòng ban',
          body: `${member.name} xin chuyển từ phòng ${member.department} sang phòng ${toDepartment}.`,
        },
      ])
    }
    return transfer
  }

  // Returns the viewer's latest request so the UI can show whether it is waiting or was decided
  async getLatestRequest(viewer: SessionData): Promise<DbDepartmentTransfer | null> {
    return this.store.departmentTransfers.findLatestByMember(viewer.userId)
  }

  async cancelRequest(viewer: SessionData): Promise<void> {
    const pending = await this.store.departmentTransfers.findPendingByMember(viewer.userId)
    if (!pending) {
      throw new DepartmentTransferError('Không có yêu cầu luân chuyển nào đang chờ duyệt.', 404, 'NotFound')
    }
    await this.store.departmentTransfers.save({ ...pending, status: 'cancelled', decidedAt: this.clock() })
  }

  // Lists the requests the viewer may decide as head of the releasing department
  async listIncoming(viewer: SessionData): Promise<DbDepartmentTransfer[]> {
    const head = await this.loadMember(viewer.userId)
    if (!head.isDepartmentHead) {
      throw new DepartmentTransferError('Chỉ Trưởng phòng mới xem được yêu cầu luân chuyển.', 403, 'Forbidden')
    }
    return this.store.departmentTransfers.findPendingByFromDepartment(head.department)
  }

  // Applies the move; the member must have no work in progress so tickets are never stranded in the old department
  async approve(viewer: SessionData, transferId: string): Promise<DbDepartmentTransfer> {
    const { head, transfer } = await this.loadDecidableTransfer(viewer, transferId)
    const member = await this.store.members.findById(transfer.memberId)
    if (!member || !member.isActive) {
      throw new DepartmentTransferError('Nhân viên không còn hoạt động trong hệ thống.', 409, 'Conflict')
    }
    if (member.department !== transfer.fromDepartment) {
      throw new DepartmentTransferError('Nhân viên đã không còn thuộc phòng ban này.', 409, 'Conflict')
    }
    const activeTickets = await this.store.tickets.findActiveByAssignee(member.name)
    if (activeTickets.length > 0) {
      throw new DepartmentTransferError(
        `${member.name} đang phụ trách ${activeTickets.length} yêu cầu chưa xử lý xong. Hãy phân công lại trước khi duyệt luân chuyển.`,
        409,
        'Conflict',
      )
    }

    const now = this.clock()
    await this.store.members.save({ ...member, department: transfer.toDepartment, updatedAt: now })
    const decided: DbDepartmentTransfer = { ...transfer, status: 'approved', decidedAt: now, decidedByUsername: head.username }
    await this.store.departmentTransfers.save(decided)

    const destinationHead = await this.findHead(transfer.toDepartment)
    await this.notifier?.notifyMembers(TRANSFER_NOTIFICATION_TYPES.approved, [
      {
        username: member.username,
        title: 'Yêu cầu luân chuyển đã được duyệt',
        body: `Bạn đã chuyển sang phòng ${transfer.toDepartment}.`,
      },
      ...(destinationHead
        ? [
            {
              username: destinationHead.username,
              title: 'Có nhân viên mới chuyển đến phòng',
              body: `${member.name} đã chuyển từ phòng ${transfer.fromDepartment} sang phòng ${transfer.toDepartment}.`,
            },
          ]
        : []),
    ])
    return decided
  }

  async reject(viewer: SessionData, transferId: string, reasonRaw: unknown): Promise<DbDepartmentTransfer> {
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : ''
    if (!reason) {
      throw new DepartmentTransferError('Vui lòng nhập lý do từ chối.', 400, 'ValidationError')
    }
    if (reason.length > MAX_REJECT_REASON_LENGTH) {
      throw new DepartmentTransferError(`Lý do từ chối tối đa ${MAX_REJECT_REASON_LENGTH} ký tự.`, 400, 'ValidationError')
    }
    const { head, transfer } = await this.loadDecidableTransfer(viewer, transferId)

    const decided: DbDepartmentTransfer = {
      ...transfer,
      status: 'rejected',
      decidedAt: this.clock(),
      decidedByUsername: head.username,
      rejectReason: reason,
    }
    await this.store.departmentTransfers.save(decided)
    await this.notifier?.notifyMembers(TRANSFER_NOTIFICATION_TYPES.rejected, [
      {
        username: transfer.username,
        title: 'Yêu cầu luân chuyển bị từ chối',
        body: `Yêu cầu chuyển sang phòng ${transfer.toDepartment} bị từ chối. Lý do: ${reason}`,
      },
    ])
    return decided
  }

  // Resolves a pending request together with the head allowed to decide it
  private async loadDecidableTransfer(
    viewer: SessionData,
    transferId: string,
  ): Promise<{ head: DbMember; transfer: DbDepartmentTransfer }> {
    const head = await this.loadMember(viewer.userId)
    const transfer = await this.store.departmentTransfers.findById(transferId)
    if (!transfer) {
      throw new DepartmentTransferError('Không tìm thấy yêu cầu luân chuyển.', 404, 'NotFound')
    }
    if (!head.isDepartmentHead || head.department !== transfer.fromDepartment) {
      throw new DepartmentTransferError('Chỉ Trưởng phòng của phòng hiện tại mới được duyệt luân chuyển.', 403, 'Forbidden')
    }
    if (transfer.status !== 'pending') {
      throw new DepartmentTransferError('Yêu cầu luân chuyển này đã được xử lý.', 409, 'Conflict')
    }
    return { head, transfer }
  }

  private async loadMember(userId: string): Promise<DbMember> {
    const member = await this.store.members.findById(userId)
    if (!member) {
      throw new DepartmentTransferError('Không tìm thấy tài khoản.', 404, 'NotFound')
    }
    return member
  }

  private async findHead(department: string): Promise<DbMember | undefined> {
    const heads = await this.store.members.findHeads([department])
    return heads.find((member) => member.isActive && member.isDepartmentHead)
  }
}
