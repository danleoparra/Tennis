import { useRef, useState } from "react";

export default function TennisReachVisualizer() {
  const real = {
    doublesWidth: 10.97,
    singlesWidth: 8.23,
    halfLength: 11.885,
    serviceLineFromNet: 6.4,
  };

  const scale = 25;
  const courtMargin = 120;
  const outerSpaceX = 80;
  const outerSpaceTop = 100;
  const outerSpaceBottom = 80;

  const court = {
    width: real.doublesWidth * scale,
    height: real.halfLength * 2 * scale,
    singlesInset: ((real.doublesWidth - real.singlesWidth) / 2) * scale,
    netY: real.halfLength * scale,
    serviceOffset: real.serviceLineFromNet * scale,
    centerX: (real.doublesWidth * scale) / 2,
  };

  const playArea = {
    x: outerSpaceX,
    y: outerSpaceTop,
    width: court.width,
    height: court.height,
  };

  const svgWidth = court.width + outerSpaceX * 2;
  const svgHeight = court.height + outerSpaceTop + outerSpaceBottom;

  const doublesLeftX = playArea.x;
  const doublesRightX = playArea.x + court.width;
  const singlesLeftX = playArea.x + court.singlesInset;
  const singlesRightX = playArea.x + court.width - court.singlesInset;
  const baselineTopY = playArea.y;
  const baselineBottomY = playArea.y + court.height;
  const netY = playArea.y + court.netY;
  const topServiceY = playArea.y + court.netY - court.serviceOffset;
  const bottomServiceY = playArea.y + court.netY + court.serviceOffset;
  const centerServiceX = playArea.x + court.centerX;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const radToDeg = (rad) => (rad * 180) / Math.PI;

  const [showLayers, setShowLayers] = useState({
    doubles: true,
    singles: true,
    service: true,
  });

  const [players, setPlayers] = useState([
    {
      id: 1,
      name: "Player 1",
      side: "bottom",
      x: playArea.x + court.centerX,
      y: playArea.y + court.netY + 190,
      color: "#2563eb",
      reach: 110,
      active: true,
    },
    {
      id: 2,
      name: "Player 2",
      side: "top",
      x: playArea.x + court.centerX,
      y: playArea.y + court.netY - 190,
      color: "#dc2626",
      reach: 110,
      active: false,
    },
  ]);

  const [draggingId, setDraggingId] = useState(null);
  const svgRef = useRef(null);

  const activePlayer = players.find((p) => p.active) || players[0];

  const getMovementBounds = (player) => {
    if (player.side === "top") {
      return {
        minX: playArea.x - courtMargin,
        maxX: playArea.x + playArea.width + courtMargin,
        minY: playArea.y - courtMargin,
        maxY: netY,
      };
    }
    return {
      minX: playArea.x - courtMargin,
      maxX: playArea.x + playArea.width + courtMargin,
      minY: netY,
      maxY: playArea.y + playArea.height + courtMargin,
    };
  };

  const getSvgPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const y = ((event.clientY - rect.top) / rect.height) * svgHeight;
    return { x, y };
  };

  const updatePlayerPosition = (id, point) => {
    if (!point) return;
    setPlayers((prev) =>
      prev.map((player) => {
        if (player.id !== id) return player;
        const bounds = getMovementBounds(player);
        return {
          ...player,
          x: clamp(point.x, bounds.minX, bounds.maxX),
          y: clamp(point.y, bounds.minY, bounds.maxY),
        };
      })
    );
  };

  const handlePointerDown = (id) => (event) => {
    event.preventDefault();
    setDraggingId(id);
  };

  const handlePointerMove = (event) => {
    if (draggingId === null) return;
    updatePlayerPosition(draggingId, getSvgPoint(event));
  };

  const handlePointerUp = () => setDraggingId(null);

  const courtCenterX = playArea.x + court.centerX;
  const halfCourtWidth = court.width / 2;
  const baseExtension = 0.6 * scale;
  const distanceToNetNorm = clamp01(Math.abs(activePlayer.y - netY) / court.netY);
  const netProximity = 1 - distanceToNetNorm;
  const activeLateralNorm = (activePlayer.x - courtCenterX) / halfCourtWidth;
  const activeSide = activeLateralNorm < 0 ? "left" : "right";

  const playerOutsideLeft = Math.max(0, singlesLeftX - activePlayer.x);
  const playerOutsideRight = Math.max(0, activePlayer.x - singlesRightX);
  const outsideBoost = 1.0;
  const netApproachBoost = netProximity * 1.2 * scale;

  const singlesLeftBaselineCorner = { x: singlesLeftX, y: baselineTopY - baseExtension };
  const singlesRightBaselineCorner = { x: singlesRightX, y: baselineTopY - baseExtension };
  const serviceLeftCorner = { x: singlesLeftX, y: topServiceY };
  const serviceRightCorner = { x: singlesRightX, y: topServiceY };
  const serviceCenterCorner = { x: centerServiceX, y: topServiceY };

  const interpolate = (p1, p2, t) => ({
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  });

  const extendThroughPoint = (origin, through, extensionDistance) => {
    const dx = through.x - origin.x;
    const dy = through.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    return {
      x: through.x + ux * extensionDistance,
      y: through.y + uy * extensionDistance,
    };
  };

  const extendToEdge = (origin, targetPoint) => {
    const dx = targetPoint.x - origin.x;
    const dy = targetPoint.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const big = Math.max(svgWidth, svgHeight) * 2;
    return {
      x: origin.x + ux * big,
      y: origin.y + uy * big,
    };
  };

  const leftSinglesAnchor =
    activeSide === "left"
      ? interpolate(singlesLeftBaselineCorner, serviceLeftCorner, netProximity)
      : {
          x: singlesLeftX - (playerOutsideRight * outsideBoost + netApproachBoost),
          y: baselineTopY - baseExtension,
        };

  const rightSinglesAnchor =
    activeSide === "right"
      ? interpolate(singlesRightBaselineCorner, serviceRightCorner, netProximity)
      : {
          x: singlesRightX + (playerOutsideLeft * outsideBoost + netApproachBoost),
          y: baselineTopY - baseExtension,
        };

  const volleyCarryDistance = 1.8 * scale;

  const singlesLeftTarget =
    activeSide === "left"
      ? extendThroughPoint(activePlayer, leftSinglesAnchor, volleyCarryDistance)
      : leftSinglesAnchor;

  const singlesRightTarget =
    activeSide === "right"
      ? extendThroughPoint(activePlayer, rightSinglesAnchor, volleyCarryDistance)
      : rightSinglesAnchor;

  const target = {
    doublesLeftWindow: { x: doublesLeftX, y: baselineTopY - baseExtension },
    doublesRightWindow: { x: doublesRightX, y: baselineTopY - baseExtension },
    singlesLeftWindow: singlesLeftTarget,
    singlesRightWindow: singlesRightTarget,
    serviceLeft: serviceLeftCorner,
    serviceCenter: serviceCenterCorner,
    serviceRight: serviceRightCorner,
  };

  const angles = {
    doublesLeftWindow: Math.atan2(target.doublesLeftWindow.y - activePlayer.y, target.doublesLeftWindow.x - activePlayer.x),
    doublesRightWindow: Math.atan2(target.doublesRightWindow.y - activePlayer.y, target.doublesRightWindow.x - activePlayer.x),
    singlesLeftWindow: Math.atan2(target.singlesLeftWindow.y - activePlayer.y, target.singlesLeftWindow.x - activePlayer.x),
    singlesRightWindow: Math.atan2(target.singlesRightWindow.y - activePlayer.y, target.singlesRightWindow.x - activePlayer.x),
    serviceLeft: Math.atan2(target.serviceLeft.y - activePlayer.y, target.serviceLeft.x - activePlayer.x),
    serviceCenter: Math.atan2(target.serviceCenter.y - activePlayer.y, target.serviceCenter.x - activePlayer.x),
    serviceRight: Math.atan2(target.serviceRight.y - activePlayer.y, target.serviceRight.x - activePlayer.x),
  };

  const openingBetween = (a, b) => {
    let diff = Math.abs(radToDeg(b - a));
    if (diff > 180) diff = 360 - diff;
    return diff;
  };

  const openings = {
    windowDoubles: openingBetween(angles.doublesLeftWindow, angles.doublesRightWindow),
    windowSingles: openingBetween(angles.singlesLeftWindow, angles.singlesRightWindow),
    serviceBoxLeft: openingBetween(angles.serviceLeft, angles.serviceCenter),
    serviceBoxRight: openingBetween(angles.serviceCenter, angles.serviceRight),
    serviceLineFull: openingBetween(angles.serviceLeft, angles.serviceRight),
  };

  const activePosition = {
    xMeters: ((activePlayer.x - playArea.x) / scale).toFixed(2),
    yMetersFromTop: ((activePlayer.y - playArea.y) / scale).toFixed(2),
  };

  const singlesLeftEnd = extendToEdge(activePlayer, target.singlesLeftWindow);
  const singlesRightEnd = extendToEdge(activePlayer, target.singlesRightWindow);
  const serviceLeftEnd = extendToEdge(activePlayer, target.serviceLeft);
  const serviceCenterEnd = extendToEdge(activePlayer, target.serviceCenter);
  const serviceRightEnd = extendToEdge(activePlayer, target.serviceRight);

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center gap-6">
      <div className="max-w-6xl w-full text-center">
        <h1 className="text-3xl font-bold text-slate-900">Tennis Court Angle Visualizer</h1>
        <p className="text-slate-600 mt-2">Drag players to study the real shot window into the opposite court.</p>
      </div>

      <div className="w-full max-w-7xl grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="bg-white rounded-3xl shadow-xl p-4 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto rounded-2xl touch-none select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#dbe4ea" />
            <rect
              x={playArea.x - courtMargin}
              y={playArea.y - courtMargin}
              width={playArea.width + courtMargin * 2}
              height={playArea.height + courtMargin * 2}
              rx="16"
              fill="#7c9a6d"
            />
            <rect x={playArea.x} y={playArea.y} width={court.width} height={court.height} fill="#256c3a" rx="10" />
            <rect x={playArea.x} y={playArea.y} width={court.width} height={court.height} fill="none" stroke="white" strokeWidth="3" />
            <line x1={singlesLeftX} y1={playArea.y} x2={singlesLeftX} y2={playArea.y + court.height} stroke="white" strokeWidth="2.5" />
            <line x1={singlesRightX} y1={playArea.y} x2={singlesRightX} y2={playArea.y + court.height} stroke="white" strokeWidth="2.5" />
            <line x1={playArea.x} y1={netY} x2={playArea.x + court.width} y2={netY} stroke="#f8fafc" strokeWidth="5" />
            <line x1={singlesLeftX} y1={topServiceY} x2={singlesRightX} y2={topServiceY} stroke="white" strokeWidth="2.5" />
            <line x1={singlesLeftX} y1={bottomServiceY} x2={singlesRightX} y2={bottomServiceY} stroke="white" strokeWidth="2.5" />
            <line x1={centerServiceX} y1={topServiceY} x2={centerServiceX} y2={bottomServiceY} stroke="white" strokeWidth="2.5" />

            {showLayers.doubles && (
              <>
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.doublesLeftWindow.x},${target.doublesLeftWindow.y} ${target.doublesRightWindow.x},${target.doublesRightWindow.y}`}
                  fill="#60a5fa"
                  opacity="0.08"
                />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={target.doublesLeftWindow.x} y2={target.doublesLeftWindow.y} stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={target.doublesRightWindow.x} y2={target.doublesRightWindow.y} stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="7 5" />
              </>
            )}

            {showLayers.singles && (
              <>
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.singlesLeftWindow.x},${target.singlesLeftWindow.y} ${target.singlesRightWindow.x},${target.singlesRightWindow.y}`}
                  fill="#f59e0b"
                  opacity="0.10"
                />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={singlesLeftEnd.x} y2={singlesLeftEnd.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={singlesRightEnd.x} y2={singlesRightEnd.y} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="7 5" />
              </>
            )}

            {showLayers.service && (
              <>
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.serviceLeft.x},${target.serviceLeft.y} ${target.serviceCenter.x},${target.serviceCenter.y}`}
                  fill="#a855f7"
                  opacity="0.10"
                />
                <polygon
                  points={`${activePlayer.x},${activePlayer.y} ${target.serviceCenter.x},${target.serviceCenter.y} ${target.serviceRight.x},${target.serviceRight.y}`}
                  fill="#22c55e"
                  opacity="0.10"
                />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={serviceLeftEnd.x} y2={serviceLeftEnd.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={serviceCenterEnd.x} y2={serviceCenterEnd.y} stroke="#22c55e" strokeWidth="2" strokeDasharray="7 5" />
                <line x1={activePlayer.x} y1={activePlayer.y} x2={serviceRightEnd.x} y2={serviceRightEnd.y} stroke="#a855f7" strokeWidth="2" strokeDasharray="7 5" />
              </>
            )}

            <circle cx={activePlayer.x} cy={activePlayer.y} r={activePlayer.reach} fill={activePlayer.color} opacity="0.10" stroke={activePlayer.color} strokeWidth="2" strokeDasharray="8 6" />

            {players.map((player) => (
              <g key={player.id}>
                <circle
                  cx={player.x}
                  cy={player.y}
                  r="11"
                  fill={player.color}
                  stroke={player.active ? "#f8fafc" : "white"}
                  strokeWidth={player.active ? "4" : "3"}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={handlePointerDown(player.id)}
                />
                <text x={player.x} y={player.y - 18} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
                  {player.name}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-md p-4">
            <h2 className="font-semibold text-slate-900 mb-3">Controls</h2>
            <div className="space-y-3">
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setPlayers((prev) => prev.map((p) => ({ ...p, active: p.id === player.id })))}
                  className={`w-full rounded-xl px-4 py-3 text-left border transition ${player.active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  {player.name}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {Object.entries(showLayers).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setShowLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${value ? "bg-green-600 text-white" : "bg-white text-slate-600"}`}
                >
                  {key.toUpperCase()} {value ? "ON" : "OFF"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4">
            <h2 className="font-semibold text-slate-900 mb-2">Shot window angles</h2>
            <div className="text-sm text-slate-700 space-y-2 leading-6">
              <p><span className="font-medium">Doubles target window:</span> {openings.windowDoubles.toFixed(1)}°</p>
              <p><span className="font-medium">Singles target window:</span> {openings.windowSingles.toFixed(1)}°</p>
              <p><span className="font-medium">Full service window:</span> {openings.serviceLineFull.toFixed(1)}°</p>
              <p><span className="font-medium">Ad service box:</span> {openings.serviceBoxLeft.toFixed(1)}°</p>
              <p><span className="font-medium">Deuce service box:</span> {openings.serviceBoxRight.toFixed(1)}°</p>
              <p><span className="font-medium">Player position:</span> x {activePosition.xMeters} m, y {activePosition.yMetersFromTop} m</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4">
            <h2 className="font-semibold text-slate-900 mb-2">Guide</h2>
            <div className="text-sm text-slate-600 leading-6 space-y-2">
              <p><span className="font-medium text-slate-800">Blue sector:</span> doubles shot window.</p>
              <p><span className="font-medium text-slate-800">Orange sector:</span> singles shot window. Near the net, the line aims toward the service-line/singles-line intersection and continues beyond it.</p>
              <p><span className="font-medium text-slate-800">Purple/green:</span> service boxes with official service margins.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
