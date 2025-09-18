"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ConceptmapTable() {
  const [data, setData] = useState<any[]>([])
  const [count, setCount] = useState(0)

  const [limit, setLimit] = useState(10) // entries per page
  const [page, setPage] = useState(1)    // current page

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        `/conceptmaps?system=all&limit=${limit}&offset=${(page - 1) * limit}`
      )
      const json = await res.json()
      setData(json.items)
      setCount(json.count)
    }
    fetchData()
  }, [limit, page])

  const totalPages = Math.ceil(count / limit)

  return (
    <div className="space-y-4">
      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <span>Show</span>
        <Select value={limit.toString()} onValueChange={(val) => { setLimit(Number(val)); setPage(1) }}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <span>entries</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Source</th>
              <th className="p-2 border">Target</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="p-2 border">{row.source_display}</td>
                <td className="p-2 border">{row.target_display}</td>
                <td className="p-2 border">{row.mapping_type}</td>
                <td className="p-2 border">{row.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>

        {/* Page numbers */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .slice(Math.max(0, page - 3), page + 2)
          .map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ))}

        <Button
          variant="outline"
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
