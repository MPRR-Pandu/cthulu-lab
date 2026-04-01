import { useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { AGENT_COLORS } from "../lib/colors";

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  hex: string;
  status: "idle" | "active" | "done";
  radius: number;
  pulsePhase: number;
}

interface Edge {
  from: string;
  to: string;
  strength: number;
  age: number;
}

export function SwarmVisual() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  const agents = useAppStore((s) => s.agents);
  const agentStatuses = useAppStore((s) => s.agentStatuses);
  const heartbeatMessages = useAppStore((s) => s.heartbeatMessages);
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const orchStatus = useAppStore((s) => s.orchStatus);
  const repoName = useAppStore((s) => s.repoName);

  // Initialize nodes from agents
  useEffect(() => {
    if (agents.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Position agents in a circle around center
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));

    nodesRef.current = agents.map((a, i) => {
      const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(w, h) * 0.32;
      const ex = existing.get(a.id);
      const colors = AGENT_COLORS[a.color] ?? AGENT_COLORS.blue;

      return {
        id: a.id,
        x: ex?.x ?? cx + Math.cos(angle) * radius,
        y: ex?.y ?? cy + Math.sin(angle) * radius,
        vx: ex?.vx ?? 0,
        vy: ex?.vy ?? 0,
        color: a.color,
        hex: colors.hex,
        status: (agentStatuses[a.id] as Node["status"]) ?? "idle",
        radius: a.id === "lead" ? 14 : 9,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    });
  }, [agents]);

  // Update statuses
  useEffect(() => {
    for (const node of nodesRef.current) {
      node.status = (agentStatuses[node.id] as Node["status"]) ?? "idle";
    }
  }, [agentStatuses]);

  // Add edges from heartbeat
  useEffect(() => {
    if (heartbeatMessages.length === 0) return;
    const last = heartbeatMessages[heartbeatMessages.length - 1];
    const fromNode = nodesRef.current.find((n) => n.id === last.from);
    const toNode = nodesRef.current.find((n) => n.id === last.to);
    if (fromNode && toNode) {
      edgesRef.current.push({
        from: last.from,
        to: last.to,
        strength: 1.0,
        age: 0,
      });
      // Keep only last 10 edges
      if (edgesRef.current.length > 10) {
        edgesRef.current = edgesRef.current.slice(-10);
      }
    }
  }, [heartbeatMessages]);

  // Add edge for active agent (user → agent)
  useEffect(() => {
    if (!activeAgentId) return;
    const exists = edgesRef.current.some(
      (e) => e.from === "user" && e.to === activeAgentId && e.age < 60
    );
    if (!exists) {
      edgesRef.current.push({
        from: "user",
        to: activeAgentId,
        strength: 0.8,
        age: 0,
      });
    }
  }, [activeAgentId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const nodes = nodesRef.current;
    const time = Date.now() / 1000;

    // Clear with fade trail
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines (subtle)
    ctx.strokeStyle = "rgba(51, 51, 51, 0.3)";
    ctx.lineWidth = 0.5;
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
    // Circle guides
    for (const r of [60, 120, 180]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Physics: elastic forces
    for (const node of nodes) {
      // Attract to circle position
      const angle =
        (nodes.indexOf(node) / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const targetR = node.id === "lead" ? 0 : Math.min(w, h) * 0.32;
      const tx = cx + Math.cos(angle) * targetR;
      const ty = cy + Math.sin(angle) * targetR;

      // Spring force
      const dx = tx - node.x;
      const dy = ty - node.y;
      const spring = 0.02;
      node.vx += dx * spring;
      node.vy += dy * spring;

      // Active nodes pulse outward slightly
      if (node.status === "active") {
        const pulse = Math.sin(time * 3 + node.pulsePhase) * 0.5;
        node.vx += (node.x - cx) * 0.001 * pulse;
        node.vy += (node.y - cy) * 0.001 * pulse;
      }

      // Mouse repulsion
      if (mouseRef.current) {
        const mx = mouseRef.current.x - node.x;
        const my = mouseRef.current.y - node.y;
        const md = Math.sqrt(mx * mx + my * my);
        if (md < 60) {
          const force = (60 - md) / 60;
          node.vx -= (mx / md) * force * 2;
          node.vy -= (my / md) * force * 2;
        }
      }

      // Damping
      node.vx *= 0.92;
      node.vy *= 0.92;

      // Update position
      node.x += node.vx;
      node.y += node.vy;

      // Clamp
      node.x = Math.max(20, Math.min(w - 20, node.x));
      node.y = Math.max(20, Math.min(h - 20, node.y));
    }

    // Draw edges
    for (let i = edgesRef.current.length - 1; i >= 0; i--) {
      const edge = edgesRef.current[i];
      edge.age++;
      edge.strength *= 0.995;

      if (edge.strength < 0.05) {
        edgesRef.current.splice(i, 1);
        continue;
      }

      const fromNode =
        edge.from === "user"
          ? { x: cx, y: h - 20, hex: "#ffffff" }
          : nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      // Animated particle along edge
      const progress = (time * 0.5 + edge.age * 0.01) % 1;
      const px = fromNode.x + (toNode.x - fromNode.x) * progress;
      const py = fromNode.y + (toNode.y - fromNode.y) * progress;

      // Edge line
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.strokeStyle = `rgba(${hexToRgb(toNode.hex)}, ${edge.strength * 0.4})`;
      ctx.lineWidth = edge.strength * 2;
      ctx.stroke();

      // Traveling particle
      ctx.beginPath();
      ctx.arc(px, py, 2 + edge.strength * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hexToRgb(toNode.hex)}, ${edge.strength * 0.8})`;
      ctx.fill();
    }

    // Draw nodes
    for (const node of nodes) {
      const isActive = node.status === "active";
      const isSelected = node.id === activeAgentId;
      const pulse = isActive ? 1 + Math.sin(time * 4 + node.pulsePhase) * 0.3 : 1;
      const r = node.radius * pulse;

      // Outer glow
      const glowR = r * (isActive ? 3.5 : 2);
      const glow = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, glowR);
      glow.addColorStop(0, `rgba(${hexToRgb(node.hex)}, ${isActive ? 0.4 : 0.15})`);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${hexToRgb(node.hex)}, 0.6)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Core circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(
        node.x - r * 0.3,
        node.y - r * 0.3,
        0,
        node.x,
        node.y,
        r
      );
      grad.addColorStop(0, `rgba(${hexToRgb(node.hex)}, ${isActive ? 1 : 0.7})`);
      grad.addColorStop(1, `rgba(${hexToRgb(node.hex)}, ${isActive ? 0.6 : 0.3})`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.strokeStyle = `rgba(${hexToRgb(node.hex)}, ${isActive ? 0.9 : 0.4})`;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = `rgba(${hexToRgb(node.hex)}, ${isActive ? 1 : 0.6})`;
      ctx.font = `${node.id === "lead" ? "bold 10px" : "9px"} monospace`;
      ctx.textAlign = "center";
      ctx.fillText(node.id, node.x, node.y + r + 12);
    }

    // HUD overlay text
    const activeCount = nodes.filter((n) => n.status === "active").length;

    // Top left - SWARM CONTROL
    ctx.fillStyle = "#808080";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("◆ SWARM CONTROL", 8, 14);

    // Status pills
    ctx.font = "9px monospace";
    const statusText = `${activeCount} RUNNING · ${nodes.length - activeCount} IDLE`;
    ctx.fillStyle = activeCount > 0 ? "#5ddb6e" : "#808080";
    ctx.fillText(statusText, 8, 26);

    // Top right - Neural status
    ctx.textAlign = "right";
    ctx.fillStyle = "#808080";
    ctx.font = "9px monospace";
    ctx.fillText(orchStatus === "idle" ? "NEURAL: STANDBY" : `NEURAL: ${orchStatus.toUpperCase()}`, w - 8, 14);

    // Bottom left - WORKFORCE
    ctx.textAlign = "left";
    ctx.fillStyle = "#808080";
    ctx.font = "bold 9px monospace";
    ctx.fillText("◆ WORKFORCE", 8, h - 24);
    ctx.font = "9px monospace";
    ctx.fillStyle = "#5ddb6e";
    ctx.fillText(`ACTIVE: ${activeCount}`, 8, h - 12);
    ctx.fillStyle = "#808080";
    ctx.fillText(`TOTAL: ${nodes.length}`, 80, h - 12);

    // Bottom right - Repo + Merge
    ctx.textAlign = "right";
    ctx.fillStyle = "#4de8e0";
    ctx.font = "9px monospace";
    ctx.fillText(`◆ MERGE: CLEAN`, w - 8, h - 24);
    ctx.fillStyle = "#808080";
    ctx.fillText(`REPO: ${repoName}`, w - 8, h - 12);

    animRef.current = requestAnimationFrame(draw);
  }, [activeAgentId, orchStatus, repoName]);

  // Start animation loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current = null;
  };

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
