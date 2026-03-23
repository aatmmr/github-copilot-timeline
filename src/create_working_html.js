const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// Read the JSON data
const jsonData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'copilot-timeline-2025.json'), 'utf8'));

// Create a simplified HTML with embedded data
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Copilot Timeline 2025</title>
    <style>
        body {
            margin: 0;
            padding: 40px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: #0d1117;
            color: #f0f6fc;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #f0f6fc;
        }

        .debug {
            background: #21262d;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 14px;
            border: 1px solid #30363d;
        }

        .heatmap-container {
            position: relative;
            overflow-x: auto;
        }

        .month-labels {
            display: flex;
            gap: 3px;
            margin-bottom: 5px;
            font-size: 12px;
            color: #7d8590;
        }

        .month-label {
            width: 12px;
            height: 15px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .heatmap-wrapper {
            display: flex;
        }

        .day-labels {
            display: flex;
            flex-direction: column;
            gap: 3px;
            margin-right: 10px;
            font-size: 12px;
            color: #7d8590;
        }

        .day-label {
            height: 12px;
            display: flex;
            align-items: center;
        }

        .heatmap {
            display: grid;
            grid-template-rows: repeat(7, 1fr);
            grid-auto-flow: column;
            gap: 3px;
        }

        .square {
            width: 12px;
            height: 12px;
            border-radius: 2px;
            background-color: #161b22;
            cursor: pointer;
            position: relative;
        }

        .square[data-level="1"] { background-color: #0e4429; }
        .square[data-level="2"] { background-color: #006d32; }
        .square[data-level="3"] { background-color: #26a641; }
        .square[data-level="4"] { background-color: #39d353; }

        .legend {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 20px;
            font-size: 12px;
            color: #7d8590;
        }

        .legend-squares {
            display: flex;
            gap: 3px;
        }

        .legend-square {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }

        .tooltip {
            position: absolute;
            background: #21262d;
            color: #f0f6fc;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            border: 1px solid #30363d;
            white-space: nowrap;
            pointer-events: none;
            z-index: 1000;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="title" id="title">GitHub Copilot Timeline 2025</div>
        
        <div class="debug" id="debug">
            Loading data...
        </div>

        <div class="heatmap-container">
            <div class="month-labels" id="monthLabels"></div>
            
            <div class="heatmap-wrapper">
                <div class="day-labels">
                    <div class="day-label">Mon</div>
                    <div class="day-label"></div>
                    <div class="day-label">Wed</div>
                    <div class="day-label"></div>
                    <div class="day-label">Fri</div>
                    <div class="day-label"></div>
                    <div class="day-label">Sun</div>
                </div>
                
                <div class="heatmap" id="heatmap"></div>
            </div>
        </div>

        <div class="legend">
            <span>Less</span>
            <div class="legend-squares">
                <div class="legend-square" style="background-color: #161b22;"></div>
                <div class="legend-square" style="background-color: #0e4429;"></div>
                <div class="legend-square" style="background-color: #006d32;"></div>
                <div class="legend-square" style="background-color: #26a641;"></div>
                <div class="legend-square" style="background-color: #39d353;"></div>
            </div>
            <span>More</span>
        </div>
    </div>

    <div class="tooltip" id="tooltip"></div>

    <script>
        // Embedded JSON data
        const jsonData = ${JSON.stringify(jsonData, null, 8)};

        function processData() {
            const dailyCounts = {};
            
            jsonData.entries.forEach(entry => {
                const date = entry.date;
                dailyCounts[date] = (dailyCounts[date] || 0) + 1;
            });
            
            return dailyCounts;
        }

        function generateHeatmap() {
            const debug = document.getElementById('debug');
            const title = document.getElementById('title');
            const heatmap = document.getElementById('heatmap');
            const monthLabels = document.getElementById('monthLabels');
            const tooltip = document.getElementById('tooltip');
            
            try {
                const dailyCounts = processData();
                const activeDates = Object.keys(dailyCounts).length;
                const maxCount = Math.max(...Object.values(dailyCounts));
                
                debug.innerHTML = \`
                    <strong>Debug Info:</strong><br>
                    Total entries: \${jsonData.metadata.total_entries}<br>
                    Active dates: \${activeDates}<br>
                    Max changes per day: \${maxCount}<br>
                    Date range: \${jsonData.metadata.date_range.earliest} to \${jsonData.metadata.date_range.latest}
                \`;
                
                title.textContent = \`GitHub Copilot Timeline 2025 (\${jsonData.metadata.total_entries} entries)\`;
                
                // Generate for 2025
                const startDate = new Date('2025-01-01');
                const endDate = new Date('2025-12-31');
                
                // Find Monday of first week
                const startOfWeek = new Date(startDate);
                const dayOfWeek = startDate.getDay();
                const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                startOfWeek.setDate(startDate.getDate() + daysToMonday);
                
                const totalWeeks = Math.ceil((endDate - startOfWeek) / (1000 * 60 * 60 * 24 * 7)) + 2;
                
                // Month labels
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                let currentMonth = -1;
                
                for (let week = 0; week < totalWeeks; week++) {
                    const weekStart = new Date(startOfWeek);
                    weekStart.setDate(startOfWeek.getDate() + (week * 7));
                    const month = weekStart.getMonth();
                    
                    const label = document.createElement('div');
                    label.className = 'month-label';
                    
                    if (month !== currentMonth && weekStart.getDate() <= 7) {
                        label.textContent = months[month];
                        currentMonth = month;
                    }
                    
                    monthLabels.appendChild(label);
                }
                
                // Generate squares
                let squaresGenerated = 0;
                let coloredSquares = 0;
                
                for (let week = 0; week < totalWeeks; week++) {
                    for (let day = 0; day < 7; day++) {
                        const currentDate = new Date(startOfWeek);
                        currentDate.setDate(startOfWeek.getDate() + (week * 7) + day);
                        
                        const square = document.createElement('div');
                        square.className = 'square';
                        squaresGenerated++;
                        
                        // Skip if outside 2025
                        if (currentDate < startDate || currentDate > endDate) {
                            square.style.visibility = 'hidden';
                            heatmap.appendChild(square);
                            continue;
                        }
                        
                        const dateStr = currentDate.toISOString().split('T')[0];
                        const count = dailyCounts[dateStr] || 0;
                        
                        let level = 0;
                        if (count === 1) level = 1;
                        else if (count === 2) level = 2;
                        else if (count >= 3 && count <= 4) level = 3;
                        else if (count >= 5) level = 4;
                        
                        if (level > 0) coloredSquares++;
                        
                        square.setAttribute('data-level', level);
                        
                        // Tooltip
                        square.addEventListener('mouseenter', function(e) {
                            const rect = square.getBoundingClientRect();
                            tooltip.style.display = 'block';
                            tooltip.style.left = Math.max(10, rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
                            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
                            
                            const dateFormatted = currentDate.toLocaleDateString('en-US', { 
                                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                            });
                            
                            tooltip.textContent = count === 0 ? 
                                \`No changes on \${dateFormatted}\` : 
                                \`\${count} change\${count === 1 ? '' : 's'} on \${dateFormatted}\`;
                        });
                        
                        square.addEventListener('mouseleave', function() {
                            tooltip.style.display = 'none';
                        });
                        
                        heatmap.appendChild(square);
                    }
                }
                
                // Update debug info with generation stats
                debug.innerHTML += \`<br>Squares generated: \${squaresGenerated}<br>Colored squares: \${coloredSquares}\`;
                
            } catch (error) {
                debug.innerHTML = \`<strong>Error:</strong> \${error.message}<br>\${error.stack}\`;
                console.error('Error generating heatmap:', error);
            }
        }

        // Generate when page loads
        window.addEventListener('load', generateHeatmap);
    </script>
</body>
</html>`;

// Write the HTML file
fs.writeFileSync(path.join(rootDir, 'copilot-timeline-working.html'), html);
console.log('✅ Created copilot-timeline-working.html with embedded data');
console.log('📊 This version should display the heatmap correctly');