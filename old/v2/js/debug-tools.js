

// Función para mostrar información de depuración
function logDebug(message) {
    if (DEBUG_MODE) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        debugInfo.innerHTML += `[${timestamp}] ${message}\n`;
        debugInfo.style.display = 'block';
        console.log(message);
    }
}

// Función para visualizar el formato de salida del modelo
function visualizeModelOutput(output) {
    const outputData = output.data;
    const outputShape = output.dims;
    
    // Crear un elemento div para mostrar la información
    const visualizationDiv = document.createElement('div');
    visualizationDiv.style.cssText = `
        background-color: #f8f9fa;
        border: 1px solid #ccc;
        border-radius: 5px;
        padding: 15px;
        margin: 15px 0;
        font-family: monospace;
        font-size: 0.9em;
        overflow-x: auto;
        white-space: nowrap;
    `;
    
    // Título
    const title = document.createElement('h3');
    title.textContent = 'Formato de Salida del Modelo';
    title.style.marginTop = '0';
    visualizationDiv.appendChild(title);
    
    // Información general
    const infoLine = document.createElement('p');
    infoLine.textContent = `Forma: [${outputShape.join(' × ')}], Total elementos: ${outputData.length}`;
    visualizationDiv.appendChild(infoLine);
    
    // Crear una tabla para mostrar los datos
    const table = document.createElement('table');
    table.style.cssText = `
        border-collapse: collapse;
        width: 100%;
        font-size: 12px;
    `;
    
    // Determinar qué mostrar dependiendo de la forma
    if (outputShape.length === 3) {
        // Formato [batch, rows, cols]
        const [batch, rows, cols] = outputShape;
        
        // Cabecera de la tabla
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Celda de esquina
        const cornerCell = document.createElement('th');
        cornerCell.textContent = 'Row/Col';
        cornerCell.style.cssText = `
            padding: 5px;
            border: 1px solid #ddd;
            background-color: #f2f2f2;
            position: sticky;
            top: 0;
            left: 0;
            z-index: 2;
        `;
        headerRow.appendChild(cornerCell);
        
        // Columnas (limitadas a un número razonable)
        const maxColsToShow = Math.min(cols, 20);
        for (let col = 0; col < maxColsToShow; col++) {
            const th = document.createElement('th');
            th.textContent = col;
            th.style.cssText = `
                padding: 5px;
                border: 1px solid #ddd;
                background-color: #f2f2f2;
                position: sticky;
                top: 0;
                z-index: 1;
            `;
            headerRow.appendChild(th);
        }
        
        // Si hay más columnas, mostrar un indicador
        if (cols > maxColsToShow) {
            const moreTh = document.createElement('th');
            moreTh.textContent = '...';
            moreTh.style.cssText = `
                padding: 5px;
                border: 1px solid #ddd;
                background-color: #f2f2f2;
                position: sticky;
                top: 0;
                z-index: 1;
            `;
            headerRow.appendChild(moreTh);
        }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Cuerpo de la tabla
        const tbody = document.createElement('tbody');
        
        for (let row = 0; row < rows; row++) {
            const tr = document.createElement('tr');
            
            // Etiqueta de fila
            const rowHeader = document.createElement('th');
            rowHeader.textContent = `Row ${row}`;
            rowHeader.style.cssText = `
                padding: 5px;
                border: 1px solid #ddd;
                background-color: #f2f2f2;
                position: sticky;
                left: 0;
                z-index: 1;
                text-align: left;
            `;
            tr.appendChild(rowHeader);
            
            // Datos de la fila
            let minVal = Number.MAX_VALUE;
            let maxVal = Number.MIN_VALUE;
            
            // Calcular min/max para toda la fila
            for (let col = 0; col < cols; col++) {
                const value = outputData[row * cols + col];
                minVal = Math.min(minVal, value);
                maxVal = Math.max(maxVal, value);
            }
            
            for (let col = 0; col < maxColsToShow; col++) {
                const td = document.createElement('td');
                const value = outputData[row * cols + col];
                td.textContent = value.toFixed(4);
                
                // Colorear según el valor (normalizado entre min y max)
                const normalizedValue = (value - minVal) / (maxVal - minVal || 1);
                const hue = normalizedValue * 240; // 0 = rojo, 240 = azul
                td.style.cssText = `
                    padding: 5px;
                    border: 1px solid #ddd;
                    background-color: hsl(${hue}, 80%, 85%);
                    text-align: right;
                `;
                tr.appendChild(td);
            }
            
            // Si hay más columnas, mostrar puntos suspensivos
            if (cols > maxColsToShow) {
                const moreTd = document.createElement('td');
                moreTd.textContent = '...';
                moreTd.style.cssText = `
                    padding: 5px;
                    border: 1px solid #ddd;
                `;
                tr.appendChild(moreTd);
            }
            
            tbody.appendChild(tr);
        }
        
        table.appendChild(tbody);
    } else if (outputShape.length === 2) {
        // Formato [rows, cols]
        const [rows, cols] = outputShape;
        
        // Cabecera
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Primera celda (esquina)
        const cornerCell = document.createElement('th');
        cornerCell.textContent = 'Row/Col';
        cornerCell.style.cssText = `
            padding: 5px;
            border: 1px solid #ddd;
            background-color: #f2f2f2;
            position: sticky;
            top: 0;
            left: 0;
            z-index: 2;
        `;
        headerRow.appendChild(cornerCell);
        
        // Columnas (limitadas)
        const maxColsToShow = Math.min(cols, 10);
        for (let col = 0; col < maxColsToShow; col++) {
            const th = document.createElement('th');
            th.textContent = col;
            th.style.cssText = `
                padding: 5px;
                border: 1px solid #ddd;
                background-color: #f2f2f2;
                position: sticky;
                top: 0;
                z-index: 1;
            `;
            headerRow.appendChild(th);
        }
        
        // Indicador si hay más columnas
        if (cols > maxColsToShow) {
            const moreTh = document.createElement('th');
            moreTh.textContent = '...';
            moreTh.style.cssText = `
                padding: 5px;
                border: 1px solid #ddd;
                background-color: #f2f2f2;
                position: sticky;
                top: 0;
                z-index: 1;
            `;
            headerRow.appendChild(moreTh);
        }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Cuerpo de la tabla
        const tbody = document.createElement('tbody');
        
        // Número de filas a mostrar (limitar si hay muchas)
        const maxRowsToShow = Math.min(rows, 20);
        
        for (let row = 0; row < maxRowsToShow; row++) {
            const tr = document.createElement('tr');
            
            // Etiqueta de fila
            const rowHeader = document.createElement('th');
            rowHeader.textContent = row;
            rowHeader.style.cssText = `
                padding: 5px;
                border: 1px solid #ddd;
                background-color: #f2f2f2;
                position: sticky;
                left: 0;
                z-index: 1;
                text-align: center;
            `;
            tr.appendChild(rowHeader);
            
            // Datos de la fila
            for (let col = 0; col < maxColsToShow; col++) {
                const td = document.createElement('td');
                const value = outputData[row * cols + col];
                td.textContent = value.toFixed(4);
                td.style.cssText = `
                    padding: 5px;
                    border: 1px solid #ddd;
                    text-align: right;
                `;
                tr.appendChild(td);
            }
            
            // Indicador si hay más columnas
            if (cols > maxColsToShow) {
                const moreTd = document.createElement('td');
                moreTd.textContent = '...';
                moreTd.style.cssText = `
                    padding: 5px;
                    border: 1px solid #ddd;
                `;
                tr.appendChild(moreTd);
            }
            
            tbody.appendChild(tr);
        }
        
        // Indicador si hay más filas
        if (rows > maxRowsToShow) {
            const moreRow = document.createElement('tr');
            const moreHeader = document.createElement('th');
            moreHeader.textContent = '...';
            moreHeader.style.cssText = `
                padding: 5px;
                border: 1px solid #ddd;
                background-color: #f2f2f2;
                position: sticky;
                left: 0;
                z-index: 1;
            `;
            moreRow.appendChild(moreHeader);
            
            for (let col = 0; col < maxColsToShow + (cols > maxColsToShow ? 1 : 0); col++) {
                const moreTd = document.createElement('td');
                moreTd.textContent = '...';
                moreTd.style.cssText = `
                    padding: 5px;
                    border: 1px solid #ddd;
                `;
                moreRow.appendChild(moreTd);
            }
            
            tbody.appendChild(moreRow);
        }
        
        table.appendChild(tbody);
    }
    
    visualizationDiv.appendChild(table);
    
    // Añadir estadísticas
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = `
        margin-top: 15px;
        font-weight: bold;
    `;
    
    // Calcular estadísticas
    let sum = 0;
    let min = Number.MAX_VALUE;
    let max = Number.MIN_VALUE;
    let zeroCount = 0;
    let smallCount = 0; // Valores entre 0 y 0.001
    let mediumCount = 0; // Valores entre 0.001 y 0.1
    let largeCount = 0; // Valores mayores a 0.1
    
    for (let i = 0; i < outputData.length; i++) {
        const value = outputData[i];
        sum += value;
        min = Math.min(min, value);
        max = Math.max(max, value);
        
        if (value === 0) zeroCount++;
        else if (value > 0 && value < 0.001) smallCount++;
        else if (value >= 0.001 && value < 0.1) mediumCount++;
        else if (value >= 0.1) largeCount++;
    }
    
    const avg = sum / outputData.length;
    
    statsDiv.innerHTML = `
        <p>Estadísticas:</p>
        <ul>
            <li>Min: ${min.toFixed(6)}</li>
            <li>Max: ${max.toFixed(6)}</li>
            <li>Promedio: ${avg.toFixed(6)}</li>
            <li>Valores cero: ${zeroCount} (${(zeroCount / outputData.length * 100).toFixed(2)}%)</li>
            <li>Valores pequeños (0-0.001): ${smallCount} (${(smallCount / outputData.length * 100).toFixed(2)}%)</li>
            <li>Valores medios (0.001-0.1): ${mediumCount} (${(mediumCount / outputData.length * 100).toFixed(2)}%)</li>
            <li>Valores grandes (>0.1): ${largeCount} (${(largeCount / outputData.length * 100).toFixed(2)}%)</li>
        </ul>
    `;
    
    visualizationDiv.appendChild(statsDiv);
    
    // Añadir un botón para ocultar/mostrar la visualización
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Ocultar Detalles';
    toggleButton.style.cssText = `
        margin-top: 10px;
        padding: 5px 10px;
        background-color: #f1f1f1;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
    `;
    
    const contentDiv = document.createElement('div');
    contentDiv.appendChild(table);
    contentDiv.appendChild(statsDiv);
    
    visualizationDiv.appendChild(toggleButton);
    visualizationDiv.appendChild(contentDiv);
    
    toggleButton.addEventListener('click', () => {
        if (contentDiv.style.display === 'none') {
            contentDiv.style.display = 'block';
            toggleButton.textContent = 'Ocultar Detalles';
        } else {
            contentDiv.style.display = 'none';
            toggleButton.textContent = 'Mostrar Detalles';
        }
    });
    
    return visualizationDiv;
}


// Agregar función para mostrar la visualización en la página
function displayModelOutputVisualization(output) {
    const container = document.createElement('div');
    container.id = 'modelOutputVisualization';
    container.style.cssText = `
        position: fixed;
        top: 50px;
        right: 20px;
        max-width: 80%;
        max-height: 80vh;
        overflow: auto;
        background-color: white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        padding: 15px;
        border-radius: 5px;
    `;
    
    // Botón para cerrar
    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    closeButton.addEventListener('click', () => {
        document.body.removeChild(container);
    });
    
    // Añadir visualización
    const visualization = visualizeModelOutput(output);
    
    container.appendChild(closeButton);
    container.appendChild(visualization);
    
    // Remover visualización anterior si existe
    const existingViz = document.getElementById('modelOutputVisualization');
    if (existingViz) {
        document.body.removeChild(existingViz);
    }
    
    document.body.appendChild(container);
}

