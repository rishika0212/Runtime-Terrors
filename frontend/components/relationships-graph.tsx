"use client"
import { useEffect, useRef } from "react"

// Minimal D3 force-directed graph. Requires: npm i d3
// Nodes are colored green/orange/yellow as requested.
// - NAMASTE/Ayurveda -> green
// - ICD (TM2/Biomedicine) -> orange
// - Disease/query hub (if used) -> yellow

type Node = {
  id: string
  label?: string
  type: "NAMASTE" | "ICD" | "DISEASE"
}

type Link = {
  source: string
  target: string
}

type Props = {
  width?: number
  height?: number
  nodes: Node[]
  links: Link[]
}

export default function RelationshipsGraph({ width = 900, height = 400, nodes, links }: Props) {
  const ref = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    let sim: any
    let cleanup = () => {}

    const run = async () => {
      const d3 = await import("d3")

      const colorFor = (type: Node["type"]) => {
        if (type === "NAMASTE") return getComputedStyle(document.documentElement).getPropertyValue("--chart-1").trim() || "#22C55E"
        if (type === "ICD") return getComputedStyle(document.documentElement).getPropertyValue("--chart-2").trim() || "#F59E0B"
        return getComputedStyle(document.documentElement).getPropertyValue("--chart-3").trim() || "#FACC15"
      }

      const svg = d3
        .select(ref.current)
        .attr("viewBox", [0, 0, width, height].join(" "))
        .attr("width", "100%")
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; background: var(--card);")

      svg.selectAll("*").remove()

      const g = svg.append("g").attr("transform", `translate(0,0)`)

      const link = g
        .append("g")
        .attr("stroke", "#CBD5E1")
        .attr("stroke-opacity", 0.7)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", 1.2)

      const node = g
        .append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 10)
        .attr("fill", (d: Node) => colorFor(d.type))
        .call(
          (d3 as any)
            .drag()
            .on("start", (event: any, d: any) => {
              if (!event.active) sim.alphaTarget(0.3).restart()
              d.fx = d.x
              d.fy = d.y
            })
            .on("drag", (event: any, d: any) => {
              d.fx = event.x
              d.fy = event.y
            })
            .on("end", (event: any, d: any) => {
              if (!event.active) sim.alphaTarget(0)
              d.fx = null
              d.fy = null
            })
        )

      const labels = g
        .append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text((d: Node) => d.label ?? d.id)
        .attr("font-size", 10)
        .attr("fill", "#334155")
        .attr("text-anchor", "middle")
        .attr("dy", 18)

      sim = (d3 as any)
        .forceSimulation(nodes as any)
        .force("link", (d3 as any).forceLink(links as any).id((d: any) => d.id).distance(80).strength(0.6))
        .force("charge", (d3 as any).forceManyBody().strength(-180))
        .force("center", (d3 as any).forceCenter(width / 2, height / 2))
        .on("tick", ticked)

      function ticked() {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y)

        node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y)
        labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
      }

      // Zoom/pan
      svg.call(
        (d3 as any)
          .zoom()
          .scaleExtent([0.5, 3])
          .on("zoom", (event: any) => g.attr("transform", event.transform))
      )

      cleanup = () => {
        sim?.stop?.()
        svg.selectAll("*").remove()
      }
    }

    run()
    return () => cleanup()
  }, [width, height, nodes, links])

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card">
      <svg ref={ref} />
      <div className="px-4 py-2 text-xs text-muted-foreground border-t">
        Relationships graph — drag nodes, scroll to zoom
      </div>
    </div>
  )
}