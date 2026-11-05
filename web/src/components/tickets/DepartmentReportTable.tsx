import type { DepartmentReportRow } from '../../lib/ticketReport.ts'
import { Panel } from '../ui/Panel.tsx'

const NO_RATING_TEXT = '–'

export function DepartmentReportTable({ rows }: { rows: DepartmentReportRow[] }) {
  return (
    <Panel title="So sánh các phòng ban">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Phòng ban</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Tiếp nhận</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Đang mở</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Quá hạn</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Đúng hạn</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">CSAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.department}>
                <th scope="row" className="px-4 py-2 font-semibold text-ink">{row.department}</th>
                <td className="px-4 py-2 text-right tabular-nums">{row.received}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.active}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.overdue}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.onTimeRate}%</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.averageRating === null ? NO_RATING_TEXT : `${row.averageRating}/5`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
