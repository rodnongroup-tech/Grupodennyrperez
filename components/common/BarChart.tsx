import React from 'react';

interface BarChartDataItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartDataItem[];
  title: string;
  width?: number;
  height?: number;
  barColor?: string;
  yAxisLabel?: string;
  year: number; // Added prop
}

const defaultBarColor = '#4f46e5'; // A nice indigo

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  width = 600, // Default value
  height = 400, // Default value
  barColor = defaultBarColor,
  yAxisLabel = 'Valor',
  year, // Destructure year
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-slate-500">No hay datos disponibles para mostrar el gráfico.</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 0);
  const chartPadding = { top: 40, right: 30, bottom: 60, left: 70 }; 
  const chartWidth = width - chartPadding.left - chartPadding.right;
  const chartHeight = height - chartPadding.top - chartPadding.bottom;

  const barWidth = chartWidth / data.length * 0.7; // 70% of available space per bar
  const barSpacing = chartWidth / data.length * 0.3;

  const yScale = maxValue > 0 ? chartHeight / maxValue : 0;

  // Generate Y-axis ticks (e.g., 5 ticks)
  const numTicks = 5;
  const yTicks = Array.from({ length: numTicks + 1 }, (_, i) => {
    const tickValue = (maxValue / numTicks) * i;
    return {
      value: tickValue,
      yPos: chartPadding.top + chartHeight - (tickValue * yScale),
    };
  });

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-700 mb-4 text-center">{title}</h3>
      <svg width={width} height={height} aria-label={title}>
        {/* Y-axis Label */}
        <text
          x={-(chartPadding.top + chartHeight / 2)}
          y={chartPadding.left / 2 - 20}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="12"
          fill="#64748b"
          fontWeight="medium"
        >
          {yAxisLabel}
        </text>

        {/* Y-axis Ticks and Grid Lines */}
        {yTicks.map(tick => (
          <g key={`ytick-${tick.value}`}>
            <text
              x={chartPadding.left - 10}
              y={tick.yPos + 4} // Adjust for vertical alignment
              textAnchor="end"
              fontSize="10"
              fill="#64748b"
            >
              {tick.value.toLocaleString(undefined, {maximumFractionDigits:0})}
            </text>
            <line // Grid line
              x1={chartPadding.left}
              y1={tick.yPos}
              x2={chartPadding.left + chartWidth}
              y2={tick.yPos}
              stroke="#e2e8f0" // Lighter grid lines
              strokeWidth="1"
              strokeDasharray={tick.value === 0 ? "" : "3,3"} // Dashed for non-zero lines
            />
          </g>
        ))}

        {/* X-axis Line */}
         <line
            x1={chartPadding.left}
            y1={chartPadding.top + chartHeight}
            x2={chartPadding.left + chartWidth}
            y2={chartPadding.top + chartHeight}
            stroke="#9ca3af" // Darker axis line
            strokeWidth="1"
        />

        {/* Bars and X-axis Labels */}
        {data.map((d, i) => {
          const barHeightValue = d.value * yScale;
          const x = chartPadding.left + i * (barWidth + barSpacing) + barSpacing / 2;
          const y = chartPadding.top + chartHeight - barHeightValue;

          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeightValue > 0 ? barHeightValue : 0} // Ensure non-negative height
                fill={d.color || barColor}
                rx="3" // Slightly rounded bars
                ry="3"
              >
                <title>{`${d.label}: ${d.value.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}</title>
              </rect>
              {/* Value on top of bar */}
              <text
                x={x + barWidth / 2}
                y={y - 5} // Position above the bar
                textAnchor="middle"
                fontSize="9"
                fill="#475569"
                fontWeight="semibold"
              >
                {d.value > 1 ? d.value.toLocaleString(undefined, {maximumFractionDigits:0}) : ''}
              </text>
              {/* X-axis Label */}
              <text
                x={x + barWidth / 2}
                y={chartPadding.top + chartHeight + 18} // Below x-axis
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
                fontWeight="medium"
              >
                {d.label}
              </text>
            </g>
          );
        })}
         {/* Legend (if multiple colors are used systematically, otherwise simple) */}
         <text
            x={width/2}
            y={height - 10}
            textAnchor="middle"
            fontSize="12"
            fill="#64748b"
            fontWeight="medium">
            Meses del Año {year}
        </text>
      </svg>
    </div>
  );
};