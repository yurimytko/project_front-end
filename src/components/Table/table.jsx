import React, { useState, useEffect, useRef } from "react";
import "./table.css";

export default function Table() {
    const columns = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    const rows = 30;

    const [tableMatrix, setTableMatrix] = useState(
        Array.from({ length: rows }, () => Array(columns.length).fill(""))
    );
    const [editingCell, setEditingCell] = useState({ rowIndex: null, columnIndex: null });
    const [columnWidths, setColumnWidths] = useState(Array(columns.length).fill(100));
    const [rowHeights, setRowHeights] = useState(Array(rows).fill(30));


    const fetchTableData = async () => {
        try {
            const response = await fetch("http://localhost:5000/api/table");
            if (!response.ok) {
                throw new Error("Failed to fetch table data");
            }
            const data = await response.json();
            const updatedMatrix = Array.from({ length: rows }, () => Array(columns.length).fill(""));

            data.forEach(({ row_index, column_index, value, formulas }) => {
                updatedMatrix[row_index][column_index] = { value, formulas };
            });
            console.log(data)
            setTableMatrix(updatedMatrix);
        } catch (error) {
            console.error("Error fetching table data:", error);
        }
    };

    useEffect(() => {

        fetchTableData();
    }, []);



    const [isFormulaMode, setIsFormulaMode] = useState(false);
    const [formula, setFormula] = useState("");

    const input = useRef()

    const handleCellDoubleClick = (rowIndex, columnIndex) => {
        const cell = tableMatrix[rowIndex][columnIndex];
        const cellValue = cell?.value || ""; 
        const cellFormula = cell?.formulas || ""; 
        setEditingCell({ rowIndex, columnIndex });

        if (cellFormula.startsWith("=")) {
            setIsFormulaMode(true);
            setFormula(cellFormula);
        } else {
            setIsFormulaMode(false);
            setFormula(cellValue);
        }
    };

    const handleInputChange = (e, rowIndex, columnIndex) => {
        const newFormula = e.target.value;

        if (newFormula.startsWith("=")) {
            setIsFormulaMode(true);
        } else {
            setIsFormulaMode(false);
        }

        setFormula(newFormula); // Update the formula value

        setTableMatrix((prev) => {
            const newMatrix = [...prev];
            newMatrix[rowIndex][columnIndex] = {
                ...newMatrix[rowIndex][columnIndex],
                formulas: newFormula, // Store the formula
            };
            return newMatrix;
        });
    };

    const handleCellClick = (rowIndex, columnIndex) => {
        if (isFormulaMode) {
            // Convert row and column index to Excel-style cell name
            const columnName = getColumnName(columnIndex); // Convert column index to letter (A, B, C, etc.)
            const rowNumber = rowIndex + 1; // Convert row index to Excel-style row number (1-based)
            const cellPosition = `${columnName}${rowNumber}`; // e.g., "A1", "B2"

            // Append the clicked cell's position to the formula
            setFormula((prevFormula) => prevFormula + cellPosition);
            input.current.focus()

        }

    };

    const handleInputBlurOrEnter = () => {
        if (editingCell.rowIndex !== null && editingCell.columnIndex !== null) {
            const { rowIndex, columnIndex } = editingCell;
            let value = formula;

            sendCellUpdate(rowIndex, columnIndex, value, formula);

            setTableMatrix((prev) => {
                const newMatrix = [...prev];
                newMatrix[rowIndex][columnIndex] = value;
                return newMatrix;
            });
        }

        setEditingCell({ rowIndex: null, columnIndex: null });
        setIsFormulaMode(false); // Disable formula mode after blurring or pressing enter
    };

    const sendCellUpdate = async (rowIndex, columnIndex, value, formula) => {
        try {
            const response = await fetch("http://localhost:5000/api/table/cell", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ rowIndex, columnIndex, value, formula }),
            });

            if (!response.ok) {
                throw new Error("Failed to update cell value");
            }

            const data = await response.json();
            console.log("Cell updated:", data);

            if (data?.calculatedValue) {
                setTableMatrix((prev) => {
                    const newMatrix = [...prev];
                    newMatrix[rowIndex][columnIndex] = data.calculatedValue;
                    return newMatrix;
                });
            }
            fetchTableData();
        } catch (error) {
            console.error("Error updating cell:", error);
        }
    };

    const getColumnName = (index) => {
        let columnName = "";
        while (index >= 0) {
            columnName = String.fromCharCode((index % 26) + 65) + columnName;
            index = Math.floor(index / 26) - 1;
        }
        return columnName;
    };

    const resizing = useRef({});

    const handleResizeColumn = (index, e) => {
        resizing.current = { type: "column", index, startX: e.clientX, startWidth: columnWidths[index] };
    };

    const handleResizeRow = (index, e) => {
        resizing.current = { type: "row", index, startY: e.clientY, startHeight: rowHeights[index] };
    };

    const handleMouseMove = (e) => {
        if (!resizing.current.type) return;

        const { type, index, startX, startY, startWidth, startHeight } = resizing.current;

        if (type === "column") {
            const delta = e.clientX - startX;
            setColumnWidths((prev) => {
                const newWidths = [...prev];
                newWidths[index] = Math.max(startWidth + delta, 50);
                return newWidths;
            });
        } else if (type === "row") {
            const delta = e.clientY - startY;
            setRowHeights((prev) => {
                const newHeights = [...prev];
                newHeights[index] = Math.max(startHeight + delta, 20);
                return newHeights;
            });
        }
    };

    const handleMouseUp = () => {
        resizing.current = {};
    };

    React.useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    console.log(tableMatrix)

    return (
        <div>
            <table border="1" style={{ borderCollapse: "collapse", width: "auto" }}>
                <thead>
                    <tr>
                        <th style={{ width: 50 }}>#</th>
                        {columns.map((colName, colIndex) => (
                            <th
                                key={colIndex}
                                style={{
                                    width: columnWidths[colIndex],
                                    position: "relative",
                                }}
                            >
                                {colName}
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        right: 0,
                                        bottom: 0,
                                        width: 5,
                                        cursor: "col-resize",
                                    }}
                                    onMouseDown={(e) => handleResizeColumn(colIndex, e)}
                                ></div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {tableMatrix.map((row, rowIndex) => (
                        <tr key={rowIndex} style={{ height: rowHeights[rowIndex] }}>
                            <td
                                style={{
                                    width: 50,
                                    position: "relative",
                                }}
                                onMouseDown={(e) => handleResizeRow(rowIndex, e)}
                            >
                                {rowIndex + 1}
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: 5,
                                        cursor: "row-resize",
                                    }}
                                ></div>
                            </td>
                            {row.map((cell, columnIndex) => (
                                <td
                                    key={columnIndex}
                                    onClick={() => handleCellClick(rowIndex, columnIndex)} // Add click handler
                                    onDoubleClick={() => handleCellDoubleClick(rowIndex, columnIndex)}
                                    style={{
                                        background:
                                            editingCell.rowIndex === rowIndex && editingCell.columnIndex === columnIndex
                                                ? "#f4f4f4"
                                                : "white",
                                        width: columnWidths[columnIndex],
                                        height: rowHeights[rowIndex],
                                        textAlign: "center",
                                    }}
                                >
                                    {editingCell.rowIndex === rowIndex && editingCell.columnIndex === columnIndex ? (
                                        <input
                                            ref={input}
                                            type="text"
                                            value={formula}
                                            onChange={(e) => handleInputChange(e, rowIndex, columnIndex)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleInputBlurOrEnter();
                                                }
                                            }}
                                            autoFocus
                                            style={{
                                                background: "none",
                                                border: "none",
                                                outline: "none",
                                                width: "100%",
                                                height: "100%",
                                                textAlign: "center",
                                            }}
                                        />
                                    ) : (
                                        editingCell.rowIndex === rowIndex && editingCell.columnIndex === columnIndex ? cell.formulas : cell.value // Show formula or value when not editing
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
