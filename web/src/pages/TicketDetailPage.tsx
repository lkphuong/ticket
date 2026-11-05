import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import type { TicketPriority, TicketStatus } from "../domain/ticket.ts";
import { formatDate, formatDateTime } from "../lib/formatDate.ts";
import { isWaitingOnViewer } from "../lib/ticketInbox.ts";
import { calculateTicketSla } from "../lib/ticketSla.ts";
import { useToast } from "../lib/toastContext.ts";
import { AttachmentList } from "../components/tickets/AttachmentList.tsx";
import { CommentForm } from "../components/tickets/CommentForm.tsx";
import { CommentThread } from "../components/tickets/CommentThread.tsx";
import { MineBadge } from "../components/tickets/MineBadge.tsx";
import { PriorityBadge } from "../components/tickets/PriorityBadge.tsx";
import { StatusBadge } from "../components/tickets/StatusBadge.tsx";
import { ActivityLog } from "../components/tickets/ActivityLog.tsx";
import { TicketActions } from "../components/tickets/TicketActions.tsx";
import { Icon } from "../components/ui/Icon.tsx";
import { TicketPrintSheet } from "../components/tickets/TicketPrintSheet.tsx";
import { TicketTimeline } from "../components/tickets/TicketTimeline.tsx";
import { DepartmentLabel } from "../components/ui/DepartmentLabel.tsx";
import { DepartmentTile } from "../components/ui/DepartmentTile.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { useTickets } from "../state/useTickets.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";

interface FactProps {
  label: string;
  children: ReactNode;
}

function Fact({ label, children }: FactProps) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

interface RequestSectionProps {
  label: string;
  body: string;
}

function RequestSection({ label, body }: RequestSectionProps) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3.5">
      <p className="mb-1 text-xs font-bold text-ink uppercase tracking-wider">
        {label}
      </p>
      <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap text-ink">
        {body}
      </p>
    </div>
  );
}

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const {
    tickets,
    viewer,
    changeStatus,
    assignTicket,
    confirmResult,
    addComment,
    changePriority,
    changeDueDate,
    cancelTicket,
    reopenTicket,
  } = useTickets();
  const { notify } = useToast();
  const [now] = useState(() => new Date());
  const ticket = tickets.find((candidate) => candidate.id === ticketId);

  if (!ticket) return <NotFoundPage />;

  const sla = calculateTicketSla(ticket, now);

  function copyToClipboard(text: string, successMessage: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          notify(successMessage, "neutral");
        })
        .catch(() => {
          notify("Không thể sao chép tự động", "danger");
        });
    } else {
      notify(successMessage, "neutral");
    }
  }

  // Shows the refusal reason when the lifecycle rules reject the action, otherwise the success message
  function report(error: string | null, successMessage: string, tone: "neutral" | "success" | "danger" = "neutral") {
    if (error) notify(error, "danger");
    else notify(successMessage, tone);
  }

  async function handleAssign(assigneeName: string) {
    const err = await assignTicket(ticket!.id, assigneeName);
    report(err, `Đã phân công xử lý cho ${assigneeName}`, "success");
  }

  async function handleChangeStatus(status: TicketStatus) {
    const err = await changeStatus(ticket!.id, status);
    report(err, "Đã cập nhật trạng thái tiến độ");
  }

  async function handleConfirm(rating: number, feedback?: string) {
    const err = await confirmResult(ticket!.id, rating, feedback);
    report(err, "Đã hoàn tất nghiệm thu kết quả", "success");
  }

  async function handleReopen(reason: string) {
    const err = await reopenTicket(ticket!.id, reason);
    report(err, "Đã yêu cầu xử lý lại", "neutral");
  }

  async function handleChangePriority(priority: TicketPriority) {
    const err = await changePriority(ticket!.id, priority);
    report(err, "Đã cập nhật mức độ ưu tiên");
  }

  async function handleChangeDueDate(dueDate: string) {
    const err = await changeDueDate(ticket!.id, dueDate);
    report(err, `Đã điều chỉnh thời hạn đến ngày ${formatDate(dueDate)}`);
  }

  async function handleCancelTicket(reason: string) {
    const err = await cancelTicket(ticket!.id, reason);
    report(err, "Đã hủy yêu cầu điều phối", "danger");
  }

  return (
    <>
      <TicketPrintSheet ticket={ticket} printedAt={now} />
      <div className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <Link
            to="/tickets"
            className="text-xs font-semibold text-accent-700 underline-offset-4 hover:underline"
          >
            Quay lại danh sách yêu cầu hỗ trợ
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded border border-accent-600 bg-surface px-2.5 py-1 text-xs font-semibold text-accent-700 hover:bg-accent-100"
            >
              <Icon name="printer" className="size-3.5" />
              In phiếu yêu cầu
            </button>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(ticket.code, `Đã sao chép mã ${ticket.code}`)
              }
              className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted hover:border-accent-600 hover:text-ink"
            >
              <Icon name="copy" className="size-3.5" />
              Sao chép mã yêu cầu
            </button>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  window.location.href,
                  "Đã sao chép liên kết yêu cầu",
                )
              }
              className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted hover:border-accent-600 hover:text-ink"
            >
              <Icon name="link" className="size-3.5" />
              Sao chép liên kết
            </button>
          </div>
        </div>

        <header className="mt-4 mb-6">
          <div className="mb-3 flex items-center gap-3 text-xs font-medium text-ink-muted">
            <DepartmentTile
              department={ticket.fromDepartment}
              sizeClass="size-7"
            />
            <span>
              Phòng <strong>{ticket.fromDepartment}</strong> gửi đến{" "}
              <strong>{ticket.toDepartment}</strong>
            </span>
            <DepartmentTile
              department={ticket.toDepartment}
              sizeClass="size-7"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-ink-muted">
              {ticket.code}
            </span>
            <h1 className="w-full text-2xl font-bold tracking-tight text-ink md:w-auto">
              {ticket.title}
            </h1>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className={`rounded px-2 py-0.5 text-xs ${sla.toneClass}`}>
              {sla.label}
            </span>
            {isWaitingOnViewer(ticket, viewer) && <MineBadge />}
          </div>
        </header>

        {ticket.cancelReason && (
          <div className="mb-6 rounded-md border border-brick-500/30 bg-brick-100/30 p-4">
            <p className="text-xs font-bold text-brick-700 uppercase tracking-wider">
              Yêu cầu đã bị hủy
            </p>
            <p className="mt-1 text-sm text-ink">{ticket.cancelReason}</p>
          </div>
        )}

        {ticket.rating !== undefined && (
          <div className="mb-6 rounded-md border border-moss-700/30 bg-moss-100/20 p-4">
            <p className="text-xs font-bold text-moss-700 uppercase tracking-wider">
              Kết quả nghiệm thu
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              Mức độ hài lòng của người gửi: {ticket.rating} / 5
            </p>
            {ticket.feedback && (
              <p className="mt-1 text-xs italic text-ink-muted">
                "{ticket.feedback}"
              </p>
            )}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Nội dung yêu cầu chi tiết">
              <div className="flex flex-col gap-4 px-4 py-4">
                <div>
                  <p className="mb-1 text-xs font-bold text-ink-muted uppercase tracking-wider">
                    Mô tả công việc
                  </p>
                  <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap text-ink">
                    {ticket.description}
                  </p>
                </div>

                {ticket.purpose && (
                  <RequestSection
                    label="Mục đích nghiệp vụ"
                    body={ticket.purpose}
                  />
                )}
                {ticket.expectedResult && (
                  <RequestSection
                    label="Kết quả bàn giao mong muốn"
                    body={ticket.expectedResult}
                  />
                )}

                <div>
                  <p className="mb-2 text-xs font-bold text-ink-muted uppercase tracking-wider">
                    Hồ sơ tài liệu đính kèm ({ticket.attachments.length})
                  </p>
                  <AttachmentList attachments={ticket.attachments} />
                </div>
              </div>
            </Panel>

            <Panel
              title={`Trao đổi nội bộ & chuyển giao (${ticket.comments.length})`}
            >
              <CommentThread comments={ticket.comments} />
              {!viewer.isExecutive && !viewer.isAdmin && viewer.role !== 'admin' && (
              <CommentForm
                onSubmit={async (body, attachments) => {
                  const err = await addComment(ticket.id, body, attachments);
                  report(err, "Đã gửi phản hồi thành công");
                }}
              />
              )}
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel title="Thao tác điều phối">
              <TicketActions
                ticket={ticket}
                viewer={viewer}
                onAssign={handleAssign}
                onChangeStatus={handleChangeStatus}
                onConfirm={handleConfirm}
                onReopen={handleReopen}
                onChangePriority={handleChangePriority}
                onChangeDueDate={handleChangeDueDate}
                onCancelTicket={handleCancelTicket}
              />
            </Panel>

            <Panel title="Tiến trình xử lý">
              <TicketTimeline ticket={ticket} />
            </Panel>

            <Panel title="Nhật ký hoạt động">
              <ActivityLog ticket={ticket} />
            </Panel>

            <Panel title="Thông tin chi tiết">
              <dl className="divide-y divide-line text-xs">
                <Fact label="Người gửi yêu cầu">
                  {ticket.requesterName}
                  <span className="mt-1 block">
                    <DepartmentLabel department={ticket.fromDepartment} />
                  </span>
                </Fact>
                <Fact label="Phòng ban tiếp nhận">
                  <DepartmentLabel department={ticket.toDepartment} />
                </Fact>
                <Fact label="Chuyên viên xử lý">
                  {ticket.assigneeName ?? "Chưa phân công"}
                </Fact>
                <Fact label="Hạn hoàn thành SLA">
                  <span
                    className={sla.isOverdue ? "font-bold text-brick-700" : ""}
                  >
                    {ticket.dueDate
                      ? formatDate(ticket.dueDate)
                      : "Không có hạn"}
                  </span>
                </Fact>
                <Fact label="Thời điểm khởi tạo">
                  {formatDateTime(ticket.createdAt)}
                </Fact>
                <Fact label="Cập nhật gần nhất">
                  {formatDateTime(ticket.updatedAt)}
                </Fact>
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
