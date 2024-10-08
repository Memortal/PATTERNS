// src/SplitSurface.js
import React, { useState, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ClipperLib from 'clipper-lib';

// Helper function to rotate points around a center
const rotatePoints = (points, angleRad, centerX, centerY) => {
    return points.map((p) => {
        const x = p.x - centerX;
        const y = p.y - centerY;
        const rotatedX = x * Math.cos(angleRad) - y * Math.sin(angleRad) + centerX;
        const rotatedY = x * Math.sin(angleRad) + y * Math.cos(angleRad) + centerY;
        return { x: rotatedX, y: rotatedY };
    });
};

// Helper function to convert HEX to RGB
const hexToRgb = (hex) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
};

// Helper function to convert RGB to HEX
const rgbToHex = (r, g, b) => {
    return (
        '#' +
        [r, g, b]
            .map((x) => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            })
            .join('')
    );
};

// Helper function to generate lightning strikes recursively
const generateLightning = (
    lines,
    x,
    y,
    width,
    height,
    maxSegments,
    branchFactor
) => {
    if (maxSegments === 0) return;

    const angle = Math.random() * Math.PI / 2 - Math.PI / 4; // -45 to 45 degrees
    const length = Math.random() * (width / 10) + width / 20;

    const x2 = x + length * Math.cos(angle);
    const y2 = y + length * Math.sin(angle);

    lines.push({
        id: uuidv4(),
        points: [{ x, y }, { x: x2, y: y2 }],
    });

    // Branching
    if (Math.random() < branchFactor) {
        generateLightning(
            lines,
            x2,
            y2,
            width,
            height,
            maxSegments - 1,
            branchFactor
        );
    }

    generateLightning(
        lines,
        x2,
        y2,
        width,
        height,
        maxSegments - 1,
        branchFactor
    );
};

const SplitSurface = () => {
    // Surface dimensions with default values (1000x500)
    const [width, setWidth] = useState(1000);
    const [height, setHeight] = useState(500);

    // Polylines state: array of objects with id, points, and optional color
    const [polylines, setPolylines] = useState([]);

    // Selected algorithm
    const [selectedAlgorithm, setSelectedAlgorithm] = useState('');

    // Parameters state: dynamic based on selected algorithm
    const [parameters, setParameters] = useState({});

    // Selected color set
    const [selectedColorSet, setSelectedColorSet] = useState('Sunset');

    // Ref for the SVG element to capture
    const svgRef = useRef(null);

    // Define parameter metadata for each algorithm
    const algorithmParameters = {
        // 1. Horizontal Grid
        'Horizontal Grid': [
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 50 },
            { name: 'offsetX', label: 'Offset X (px)', type: 'number', default: 0 },
            { name: 'offsetY', label: 'Offset Y (px)', type: 'number', default: 0 },
        ],
        // 2. Vertical Grid
        'Vertical Grid': [
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 50 },
            { name: 'offsetX', label: 'Offset X (px)', type: 'number', default: 0 },
            { name: 'offsetY', label: 'Offset Y (px)', type: 'number', default: 0 },
        ],
        // 3. Random Lines
        'Random Lines': [
            { name: 'numberOfLines', label: 'Number of Lines', type: 'number', default: 10 },
            { name: 'minLength', label: 'Minimum Length (px)', type: 'number', default: 50 },
            { name: 'maxLength', label: 'Maximum Length (px)', type: 'number', default: 200 },
        ],
        // 4. Bezier Curves
        'Bezier Curves': [
            { name: 'controlPoints', label: 'Control Points (JSON)', type: 'text', default: '[]' },
            { name: 'smoothness', label: 'Smoothness', type: 'number', default: 20 },
            { name: 'curveCount', label: 'Curve Count', type: 'number', default: 1 },
        ],
        // 5. Lightning Strikes
        'Lightning Strikes': [
            { name: 'numberOfStrikes', label: 'Number of Strikes', type: 'number', default: 5 },
            { name: 'maxSegments', label: 'Max Segments', type: 'number', default: 10 },
            { name: 'branchFactor', label: 'Branch Factor (0-1)', type: 'number', default: 0.3 },
        ],
        // 6. Crosshatch Pattern
        'Crosshatch Pattern': [
            { name: 'horizontalSpacing', label: 'Horizontal Spacing (px)', type: 'number', default: 50 },
            { name: 'verticalSpacing', label: 'Vertical Spacing (px)', type: 'number', default: 50 },
            { name: 'rotation', label: 'Rotation (degrees)', type: 'number', default: 0 },
        ],
        // 7. Spiral Lines
        'Spiral Lines': [
            { name: 'turns', label: 'Number of Turns', type: 'number', default: 3 },
            { name: 'tightness', label: 'Tightness', type: 'number', default: 5 },
            { name: 'lineLength', label: 'Line Length', type: 'number', default: 2 },
        ],
        // 8. Radial Lines
        'Radial Lines': [
            { name: 'numberOfLines', label: 'Number of Lines', type: 'number', default: 12 },
            { name: 'length', label: 'Length (px)', type: 'number', default: 200 },
            { name: 'spread', label: 'Spread (degrees)', type: 'number', default: 360 },
        ],
        // 9. Sine Wave Lines
        'Sine Wave Lines': [
            { name: 'amplitude', label: 'Amplitude', type: 'number', default: 50 },
            { name: 'frequency', label: 'Frequency', type: 'number', default: 2 },
            { name: 'phase', label: 'Phase (degrees)', type: 'number', default: 0 },
        ],
        // 10. Zig-Zag Lines
        'Zig-Zag Lines': [
            { name: 'numberOfZigs', label: 'Number of Zigs', type: 'number', default: 10 },
            { name: 'amplitude', label: 'Amplitude (px)', type: 'number', default: 50 },
            { name: 'zigSpacing', label: 'Zig Spacing (px)', type: 'number', default: 100 },
        ],
        // 11. Hexagonal Grid
        'Hexagonal Grid': [
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 60 },
            { name: 'rotation', label: 'Rotation (degrees)', type: 'number', default: 0 },
            { name: 'offset', label: 'Offset (px)', type: 'number', default: 0 },
        ],
        // 12. Random Circles
        'Random Circles': [
            { name: 'numberOfCircles', label: 'Number of Circles', type: 'number', default: 15 },
            { name: 'minRadius', label: 'Minimum Radius (px)', type: 'number', default: 20 },
            { name: 'maxRadius', label: 'Maximum Radius (px)', type: 'number', default: 100 },
        ],
        // 13. Lattice Lines
        'Lattice Lines': [
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 50 },
            { name: 'rotation', label: 'Rotation (degrees)', type: 'number', default: 0 },
            { name: 'density', label: 'Density', type: 'number', default: 1 },
        ],
        // 14. Wave Mesh
        'Wave Mesh': [
            { name: 'amplitude', label: 'Amplitude', type: 'number', default: 20 },
            { name: 'wavelength', label: 'Wavelength (px)', type: 'number', default: 100 },
            { name: 'frequency', label: 'Frequency', type: 'number', default: 5 },
        ],
        // 15. Star Patterns
        'Star Patterns': [
            { name: 'numberOfPoints', label: 'Number of Points', type: 'number', default: 5 },
            { name: 'outerRadius', label: 'Outer Radius (px)', type: 'number', default: 100 },
            { name: 'innerRadius', label: 'Inner Radius (px)', type: 'number', default: 50 },
        ],
        // 16. Diamond Grid
        'Diamond Grid': [
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 60 },
            { name: 'rotation', label: 'Rotation (degrees)', type: 'number', default: 0 },
            { name: 'offset', label: 'Offset (px)', type: 'number', default: 0 },
        ],
        // 17. Parabolic Waves
        'Parabolic Waves': [
            { name: 'amplitude', label: 'Amplitude', type: 'number', default: 30 },
            { name: 'waveWidth', label: 'Wave Width (px)', type: 'number', default: 100 },
            { name: 'frequency', label: 'Frequency', type: 'number', default: 3 },
        ],
        // 18. Mandala Circles
        'Mandala Circles': [
            { name: 'numberOfLayers', label: 'Number of Layers', type: 'number', default: 5 },
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 30 },
            { name: 'rotation', label: 'Rotation (degrees)', type: 'number', default: 0 },
        ],
        // 19. Gradient Lines
        'Gradient Lines': [
            { name: 'numberOfLines', label: 'Number of Lines', type: 'number', default: 50 },
            { name: 'startColor', label: 'Start Color', type: 'color', default: '#FF0000' },
            { name: 'endColor', label: 'End Color', type: 'color', default: '#0000FF' },
        ],
        // 20. Concentric Horizontal Circles
        'Concentric Horizontal Circles': [
            { name: 'numberOfCircles', label: 'Number of Circles', type: 'number', default: 10 },
            { name: 'radiusStep', label: 'Radius Step (px)', type: 'number', default: 20 },
            { name: 'startRadius', label: 'Start Radius (px)', type: 'number', default: 10 },
        ],
        // 21. Concentric Vertical Circles
        'Concentric Vertical Circles': [
            { name: 'numberOfCircles', label: 'Number of Circles', type: 'number', default: 10 },
            { name: 'radiusStep', label: 'Radius Step (px)', type: 'number', default: 20 },
            { name: 'startRadius', label: 'Start Radius (px)', type: 'number', default: 10 },
        ],
        // 22. Fractal Lines
        'Fractal Lines': [
            { name: 'recursionDepth', label: 'Recursion Depth', type: 'number', default: 4 },
            { name: 'initialLength', label: 'Initial Length (px)', type: 'number', default: 100 },
            { name: 'angle', label: 'Angle (degrees)', type: 'number', default: 30 },
        ],
        // 23. Checkerboard Diagonals
        'Checkerboard Diagonals': [
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 50 },
            { name: 'angle', label: 'Angle (degrees)', type: 'number', default: 45 },
            { name: 'density', label: 'Density', type: 'number', default: 10 },
        ],
        // 24. Arrow Patterns
        'Arrow Patterns': [
            { name: 'numberOfArrows', label: 'Number of Arrows', type: 'number', default: 12 },
            { name: 'arrowLength', label: 'Arrow Length (px)', type: 'number', default: 100 },
            { name: 'spread', label: 'Spread (degrees)', type: 'number', default: 360 },
        ],
        // 25. Wavy Lines
        'Wavy Lines': [
            { name: 'amplitude', label: 'Amplitude', type: 'number', default: 20 },
            { name: 'wavelength', label: 'Wavelength (px)', type: 'number', default: 100 },
            { name: 'numberOfWaves', label: 'Number of Waves', type: 'number', default: 5 },
        ],
        // 26. Circular Patterns
        'Circular Patterns': [
            { name: 'numberOfCircles', label: 'Number of Circles', type: 'number', default: 10 },
            { name: 'radiusStep', label: 'Radius Step (px)', type: 'number', default: 15 },
            { name: 'startRadius', label: 'Start Radius (px)', type: 'number', default: 10 },
        ],
        // 27. Spiral Radials
        'Spiral Radials': [
            { name: 'turns', label: 'Number of Turns', type: 'number', default: 3 },
            { name: 'radiusIncrement', label: 'Radius Increment (px)', type: 'number', default: 10 },
            { name: 'lineSpacing', label: 'Line Spacing (px)', type: 'number', default: 5 },
        ],
        // 28. Random Spiral Lines
        'Random Spiral Lines': [
            { name: 'numberOfSpirals', label: 'Number of Spirals', type: 'number', default: 5 },
            { name: 'maxTurns', label: 'Max Turns', type: 'number', default: 6 },
            { name: 'spacing', label: 'Spacing (px)', type: 'number', default: 10 },
        ],
        // 29. Gradient Circles
        'Gradient Circles': [
            { name: 'numberOfCircles', label: 'Number of Circles', type: 'number', default: 10 },
            { name: 'radiusStep', label: 'Radius Step (px)', type: 'number', default: 15 },
            { name: 'startRadius', label: 'Start Radius (px)', type: 'number', default: 10 },
        ],
        // 30. Additional Placeholder Algorithm
        'Algorithm 30': [
            { name: 'param1', label: 'Parameter 1', type: 'number', default: 0 },
            { name: 'param2', label: 'Parameter 2', type: 'number', default: 0 },
            { name: 'param3', label: 'Parameter 3', type: 'number', default: 0 },
        ],
    };

    // Define all algorithms with parameter usage
    const algorithms = {
        // 1. Horizontal Grid
        'Horizontal Grid': (width, height, params) => {
            const { spacing, offsetX, offsetY } = params;
            const lines = [];
            for (let y = offsetY; y < height; y += spacing) {
                lines.push({
                    id: uuidv4(),
                    points: [
                        { x: 0 + offsetX, y },
                        { x: width + offsetX, y },
                    ],
                });
            }
            return lines;
        },
        // 2. Vertical Grid
        'Vertical Grid': (width, height, params) => {
            const { spacing, offsetX, offsetY } = params;
            const lines = [];
            for (let x = offsetX; x < width; x += spacing) {
                lines.push({
                    id: uuidv4(),
                    points: [
                        { x, y: 0 + offsetY },
                        { x, y: height + offsetY },
                    ],
                });
            }
            return lines;
        },
        // 3. Random Lines
        'Random Lines': (width, height, params) => {
            const { numberOfLines, minLength, maxLength } = params;
            const lines = [];
            for (let i = 0; i < numberOfLines; i++) {
                const x1 = Math.random() * width;
                const y1 = Math.random() * height;
                const angle = Math.random() * 2 * Math.PI;
                const length = minLength + Math.random() * (maxLength - minLength);
                const x2 = x1 + length * Math.cos(angle);
                const y2 = y1 + length * Math.sin(angle);
                lines.push({
                    id: uuidv4(),
                    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
                });
            }
            return lines;
        },
        // 4. Bezier Curves
        'Bezier Curves': (width, height, params) => {
            const { controlPoints, smoothness, curveCount } = params;
            let cps;
            try {
                cps = JSON.parse(controlPoints);
                if (!Array.isArray(cps) || cps.length < 4) {
                    throw new Error('Invalid control points');
                }
            } catch (error) {
                alert('Invalid Control Points. Please enter a valid JSON array with at least 4 points.');
                return [];
            }
            const lines = [];
            for (let c = 0; c < curveCount; c++) {
                for (let i = 0; i < cps.length - 3; i += 3) {
                    const p0 = cps[i];
                    const p1 = cps[i + 1];
                    const p2 = cps[i + 2];
                    const p3 = cps[i + 3];
                    const points = [];
                    for (let t = 0; t <= 1; t += 1 / smoothness) {
                        const x =
                            Math.pow(1 - t, 3) * p0.x +
                            3 * Math.pow(1 - t, 2) * t * p1.x +
                            3 * (1 - t) * Math.pow(t, 2) * p2.x +
                            Math.pow(t, 3) * p3.x;
                        const y =
                            Math.pow(1 - t, 3) * p0.y +
                            3 * Math.pow(1 - t, 2) * t * p1.y +
                            3 * (1 - t) * Math.pow(t, 2) * p2.y +
                            Math.pow(t, 3) * p3.y;
                        points.push({ x, y });
                    }
                    for (let j = 0; j < points.length - 1; j++) {
                        lines.push({
                            id: uuidv4(),
                            points: [
                                { x: points[j].x, y: points[j].y },
                                { x: points[j + 1].x, y: points[j + 1].y },
                            ],
                        });
                    }
                }
            }
            return lines;
        },
        // 5. Lightning Strikes
        'Lightning Strikes': (width, height, params) => {
            const { numberOfStrikes, maxSegments, branchFactor } = params;
            const lines = [];

            for (let i = 0; i < numberOfStrikes; i++) {
                const startX = Math.random() * width;
                const startY = 0;
                generateLightning(lines, startX, startY, width, height, maxSegments, branchFactor);
            }

            return lines;
        },
        // 6. Crosshatch Pattern
        'Crosshatch Pattern': (width, height, params) => {
            const { horizontalSpacing, verticalSpacing, rotation } = params;
            const lines = [];
            const angleRad = (rotation * Math.PI) / 180;

            // Horizontal lines
            for (let y = 0; y <= height; y += horizontalSpacing) {
                const x1 = 0;
                const y1 = y;
                const x2 = width;
                const y2 = y;
                // Apply rotation
                const rotatedPoints = rotatePoints(
                    [
                        { x: x1, y: y1 },
                        { x: x2, y: y2 },
                    ],
                    angleRad,
                    width / 2,
                    height / 2
                );
                lines.push({
                    id: uuidv4(),
                    points: rotatedPoints,
                });
            }

            // Vertical lines
            for (let x = 0; x <= width; x += verticalSpacing) {
                const x1 = x;
                const y1 = 0;
                const x2 = x;
                const y2 = height;
                // Apply rotation
                const rotatedPoints = rotatePoints(
                    [
                        { x: x1, y: y1 },
                        { x: x2, y: y2 },
                    ],
                    angleRad,
                    width / 2,
                    height / 2
                );
                lines.push({
                    id: uuidv4(),
                    points: rotatedPoints,
                });
            }

            return lines;
        },
        // 7. Spiral Lines
        'Spiral Lines': (width, height, params) => {
            const { turns, tightness, lineLength } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];
            const numberOfPoints = 500;
            const spiralPoints = [];

            for (let t = 0; t < numberOfPoints; t++) {
                const angle = (t / numberOfPoints) * turns * 2 * Math.PI;
                const radius = tightness * angle;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                spiralPoints.push({ x, y });
            }
            // Convert points to lines
            for (let i = 0; i < spiralPoints.length - 1; i++) {
                lines.push({
                    id: uuidv4(),
                    points: [
                        { x: spiralPoints[i].x, y: spiralPoints[i].y },
                        { x: spiralPoints[i + 1].x, y: spiralPoints[i + 1].y },
                    ],
                });
            }
            return lines;
        },
        // 8. Radial Lines
        'Radial Lines': (width, height, params) => {
            const { numberOfLines, length, spread } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];
            const spreadRad = (spread * Math.PI) / 180;
            const angleIncrement = spreadRad / numberOfLines;
            for (let i = 0; i < numberOfLines; i++) {
                const angle = i * angleIncrement;
                const x = centerX + length * Math.cos(angle);
                const y = centerY + length * Math.sin(angle);
                lines.push({
                    id: uuidv4(),
                    points: [{ x: centerX, y: centerY }, { x, y }],
                });
            }
            return lines;
        },
        // 9. Sine Wave Lines
        'Sine Wave Lines': (width, height, params) => {
            const { amplitude, frequency, phase } = params;
            const lines = [];
            const numberOfPoints = 200;
            const points = [];
            for (let i = 0; i <= numberOfPoints; i++) {
                const x = (i / numberOfPoints) * width;
                const y =
                    height / 2 +
                    amplitude *
                    Math.sin(
                        (i / numberOfPoints) * frequency * 2 * Math.PI +
                        (phase * Math.PI) / 180
                    );
                points.push({ x, y });
            }
            // Convert points to lines
            for (let i = 0; i < points.length - 1; i++) {
                lines.push({
                    id: uuidv4(),
                    points: [{ x: points[i].x, y: points[i].y }, { x: points[i + 1].x, y: points[i + 1].y }],
                });
            }
            return lines;
        },
        // 10. Zig-Zag Lines
        'Zig-Zag Lines': (width, height, params) => {
            const { numberOfZigs, amplitude, zigSpacing } = params;
            const lines = [];
            for (let i = 0; i < numberOfZigs; i++) {
                const x1 = i * zigSpacing;
                const y1 = i % 2 === 0 ? 0 : height;
                const x2 = (i + 1) * zigSpacing;
                const y2 = i % 2 === 0 ? height : 0;
                lines.push({
                    id: uuidv4(),
                    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
                });
            }
            return lines;
        },
        // 11. Hexagonal Grid
        'Hexagonal Grid': (width, height, params) => {
            const { spacing, rotation, offset } = params;
            const lines = [];
            const angleRad = (rotation * Math.PI) / 180;

            for (let y = -spacing; y < height + spacing; y += spacing) {
                for (let x = -spacing; x < width + spacing; x += spacing) {
                    // Draw horizontal lines of hexagon
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: x + offset, y: y },
                            { x: x + spacing / 2 + offset, y: y + (spacing * Math.sqrt(3)) / 2 },
                            { x: x - spacing / 2 + offset, y: y + (spacing * Math.sqrt(3)) / 2 },
                            { x: x + offset, y: y },
                        ],
                    });
                }
            }

            // Apply rotation if needed
            if (rotation !== 0) {
                lines.forEach((line) => {
                    line.points = rotatePoints(line.points, angleRad, width / 2, height / 2);
                });
            }

            return lines;
        },
        // 12. Random Circles
        'Random Circles': (width, height, params) => {
            const { numberOfCircles, minRadius, maxRadius } = params;
            const lines = [];

            for (let i = 0; i < numberOfCircles; i++) {
                const radius = minRadius + Math.random() * (maxRadius - minRadius);
                const centerX = Math.random() * width;
                const centerY = Math.random() * height;
                const numberOfPoints = 60;
                const points = [];

                for (let j = 0; j <= numberOfPoints; j++) {
                    const angle = (j / numberOfPoints) * 2 * Math.PI;
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    points.push({ x, y });
                }

                for (let j = 0; j < points.length - 1; j++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[j].x, y: points[j].y },
                            { x: points[j + 1].x, y: points[j + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 13. Lattice Lines
        'Lattice Lines': (width, height, params) => {
            const { spacing, rotation, density } = params;
            const lines = [];
            const angleRad = (rotation * Math.PI) / 180;

            for (let i = 0; i < density; i++) {
                for (let x = 0; x <= width; x += spacing) {
                    lines.push({
                        id: uuidv4(),
                        points: [{ x: x, y: 0 }, { x: x, y: height }],
                    });
                }

                for (let y = 0; y <= height; y += spacing) {
                    lines.push({
                        id: uuidv4(),
                        points: [{ x: 0, y: y }, { x: width, y: y }],
                    });
                }

                // Apply rotation if needed
                if (rotation !== 0) {
                    lines.forEach((line) => {
                        line.points = rotatePoints(line.points, angleRad, width / 2, height / 2);
                    });
                }
            }

            return lines;
        },
        // 14. Wave Mesh
        'Wave Mesh': (width, height, params) => {
            const { amplitude, wavelength, frequency } = params;
            const lines = [];
            const numberOfLines = frequency * 10;

            for (let i = 0; i < numberOfLines; i++) {
                const y = (i / numberOfLines) * height;
                const points = [];

                for (let x = 0; x <= width; x += 10) {
                    const wave = amplitude * Math.sin((x / wavelength) * 2 * Math.PI);
                    points.push({ x, y: y + wave });
                }

                for (let j = 0; j < points.length - 1; j++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[j].x, y: points[j].y },
                            { x: points[j + 1].x, y: points[j + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 15. Star Patterns
        'Star Patterns': (width, height, params) => {
            const { numberOfPoints, outerRadius, innerRadius } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];
            const totalPoints = numberOfPoints * 2;

            const points = [];

            for (let i = 0; i < totalPoints; i++) {
                const angle = (i / totalPoints) * 2 * Math.PI - Math.PI / 2;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                points.push({ x, y });
            }

            for (let i = 0; i < points.length; i++) {
                lines.push({
                    id: uuidv4(),
                    points: [
                        { x: points[i].x, y: points[i].y },
                        { x: points[(i + 2) % points.length].x, y: points[(i + 2) % points.length].y },
                    ],
                });
            }

            return lines;
        },
        // 16. Diamond Grid
        'Diamond Grid': (width, height, params) => {
            const { spacing, rotation, offset } = params;
            const lines = [];
            const angleRad = (rotation * Math.PI) / 180;

            for (let y = -spacing; y < height + spacing; y += spacing) {
                for (let x = -spacing; x < width + spacing; x += spacing) {
                    // Draw diamond shape
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: x + offset, y: y },
                            { x: x + spacing / 2 + offset, y: y + spacing / 2 },
                            { x: x + offset, y: y + spacing },
                            { x: x - spacing / 2 + offset, y: y + spacing / 2 },
                            { x: x + offset, y: y },
                        ],
                    });
                }
            }

            // Apply rotation if needed
            if (rotation !== 0) {
                lines.forEach((line) => {
                    line.points = rotatePoints(line.points, angleRad, width / 2, height / 2);
                });
            }

            return lines;
        },
        // 17. Parabolic Waves
        'Parabolic Waves': (width, height, params) => {
            const { amplitude, waveWidth, frequency } = params;
            const lines = [];
            const numberOfLines = frequency * 10;

            for (let i = 0; i < numberOfLines; i++) {
                const y = (i / numberOfLines) * height;
                const points = [];

                for (let x = 0; x <= width; x += 10) {
                    const parabola = amplitude * Math.pow((x - width / 2) / (waveWidth / 2), 2);
                    points.push({ x, y: y + parabola });
                }

                for (let j = 0; j < points.length - 1; j++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[j].x, y: points[j].y },
                            { x: points[j + 1].x, y: points[j + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 18. Mandala Circles
        'Mandala Circles': (width, height, params) => {
            const { numberOfLayers, spacing, rotation } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];
            const angleRad = (rotation * Math.PI) / 180;

            for (let layer = 1; layer <= numberOfLayers; layer++) {
                const radius = layer * spacing;
                const numberOfPoints = 100;
                const points = [];

                for (let i = 0; i <= numberOfPoints; i++) {
                    const angle = (i / numberOfPoints) * 2 * Math.PI;
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    points.push({ x, y });
                }

                for (let i = 0; i < points.length - 1; i++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[i].x, y: points[i].y },
                            { x: points[i + 1].x, y: points[i + 1].y },
                        ],
                    });
                }
            }

            // Apply rotation if needed
            if (rotation !== 0) {
                lines.forEach((line) => {
                    line.points = rotatePoints(line.points, angleRad, centerX, centerY);
                });
            }

            return lines;
        },
        // 19. Gradient Lines
        'Gradient Lines': (width, height, params) => {
            const { numberOfLines, startColor, endColor } = params;
            const lines = [];
            const startRGB = hexToRgb(startColor);
            const endRGB = hexToRgb(endColor);

            if (!startRGB || !endRGB) {
                alert('Invalid Start or End Color.');
                return [];
            }

            for (let i = 0; i < numberOfLines; i++) {
                const t = i / (numberOfLines - 1);
                const color = {
                    r: Math.round(startRGB.r + t * (endRGB.r - startRGB.r)),
                    g: Math.round(startRGB.g + t * (endRGB.g - startRGB.g)),
                    b: Math.round(startRGB.b + t * (endRGB.b - startRGB.b)),
                };
                const hexColor = rgbToHex(color.r, color.g, color.b);

                const x1 = Math.random() * width;
                const y1 = Math.random() * height;
                const angle = Math.random() * 2 * Math.PI;
                const length = Math.random() * (width / 4);
                const x2 = x1 + length * Math.cos(angle);
                const y2 = y1 + length * Math.sin(angle);

                lines.push({
                    id: uuidv4(),
                    color: hexColor,
                    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
                });
            }

            return lines;
        },
        // 20. Concentric Horizontal Circles
        'Concentric Horizontal Circles': (width, height, params) => {
            const { numberOfCircles, radiusStep, startRadius } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];

            for (let r = startRadius; r < startRadius + radiusStep * numberOfCircles; r += radiusStep) {
                const points = [];
                const numberOfPoints = 100;
                for (let i = 0; i <= numberOfPoints; i++) {
                    const angle = (i / numberOfPoints) * 2 * Math.PI;
                    const x = centerX + r * Math.cos(angle);
                    const y = centerY + r * Math.sin(angle);
                    points.push({ x, y });
                }
                // Convert points to lines
                for (let i = 0; i < points.length - 1; i++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[i].x, y: points[i].y },
                            { x: points[i + 1].x, y: points[i + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 21. Concentric Vertical Circles
        'Concentric Vertical Circles': (width, height, params) => {
            // Using the same implementation as "Concentric Horizontal Circles" for demonstration
            return algorithms['Concentric Horizontal Circles'](width, height, params);
        },
        // 22. Fractal Lines
        'Fractal Lines': (width, height, params) => {
            const { recursionDepth, initialLength, angle } = params;
            const lines = [];
            const startPoint = { x: width / 2, y: height / 2 };
            const generateFractal = (point, length, depth, angleOffset) => {
                if (depth === 0) return;
                const endPoint = {
                    x: point.x + length * Math.cos((angleOffset * Math.PI) / 180),
                    y: point.y + length * Math.sin((angleOffset * Math.PI) / 180),
                };
                lines.push({
                    id: uuidv4(),
                    points: [point, endPoint],
                });
                generateFractal(endPoint, length / 2, depth - 1, angleOffset + angle);
                generateFractal(endPoint, length / 2, depth - 1, angleOffset - angle);
            };
            generateFractal(startPoint, initialLength, recursionDepth, angle);
            return lines;
        },
        // 23. Checkerboard Diagonals
        'Checkerboard Diagonals': (width, height, params) => {
            const { spacing, angle, density } = params;
            const lines = [];
            const angleRad = (angle * Math.PI) / 180;

            for (let i = 0; i < density; i++) {
                for (let x = 0; x < width; x += spacing) {
                    const y = x * Math.tan(angleRad);
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: x, y: y },
                            { x: x + spacing, y: y + spacing * Math.tan(angleRad) },
                        ],
                    });
                }
            }

            for (let i = 0; i < density; i++) {
                for (let x = 0; x < width; x += spacing) {
                    const y = height - x * Math.tan(angleRad);
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: x, y: y },
                            { x: x + spacing, y: y - spacing * Math.tan(angleRad) },
                        ],
                    });
                }
            }

            return lines;
        },
        // 24. Arrow Patterns
        'Arrow Patterns': (width, height, params) => {
            const { numberOfArrows, arrowLength, spread } = params;
            const lines = [];
            const spreadRad = (spread * Math.PI) / 180;
            const centerX = width / 2;
            const centerY = height / 2;
            const angleIncrement = spreadRad / numberOfArrows;

            for (let i = 0; i < numberOfArrows; i++) {
                const angle = i * angleIncrement;
                const x = centerX + arrowLength * Math.cos(angle);
                const y = centerY + arrowLength * Math.sin(angle);
                lines.push({
                    id: uuidv4(),
                    points: [{ x: centerX, y: centerY }, { x, y }],
                });
            }

            return lines;
        },
        // 25. Wavy Lines
        'Wavy Lines': (width, height, params) => {
            const { amplitude, wavelength, numberOfWaves } = params;
            const lines = [];
            const numberOfPoints = 200;

            for (let w = 0; w < numberOfWaves; w++) {
                const offsetX = (w / numberOfWaves) * width;
                const points = [];
                for (let i = 0; i <= numberOfPoints; i++) {
                    const x = (i / numberOfPoints) * wavelength + offsetX;
                    const y = height / 2 + amplitude * Math.sin((i / numberOfPoints) * 2 * Math.PI);
                    points.push({ x, y });
                }
                for (let i = 0; i < points.length - 1; i++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[i].x, y: points[i].y },
                            { x: points[i + 1].x, y: points[i + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 26. Circular Patterns
        'Circular Patterns': (width, height, params) => {
            const { numberOfCircles, radiusStep, startRadius } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];

            for (let r = startRadius; r < startRadius + radiusStep * numberOfCircles; r += radiusStep) {
                const points = [];
                const numberOfPoints = 100;
                for (let i = 0; i <= numberOfPoints; i++) {
                    const angle = (i / numberOfPoints) * 2 * Math.PI;
                    const x = centerX + r * Math.cos(angle);
                    const y = centerY + r * Math.sin(angle);
                    points.push({ x, y });
                }
                // Convert points to lines
                for (let i = 0; i < points.length - 1; i++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[i].x, y: points[i].y },
                            { x: points[i + 1].x, y: points[i + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 27. Spiral Radials
        'Spiral Radials': (width, height, params) => {
            const { turns, radiusIncrement, lineSpacing } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];
            let currentRadius = 0;

            for (let t = 0; t < turns * 2 * Math.PI; t += lineSpacing / radiusIncrement) {
                const x = centerX + currentRadius * Math.cos(t);
                const y = centerY + currentRadius * Math.sin(t);
                const xNext = centerX + (currentRadius + radiusIncrement) * Math.cos(t + lineSpacing / radiusIncrement);
                const yNext = centerY + (currentRadius + radiusIncrement) * Math.sin(t + lineSpacing / radiusIncrement);
                lines.push({
                    id: uuidv4(),
                    points: [{ x, y }, { x: xNext, y: yNext }],
                });
                currentRadius += radiusIncrement;
            }

            return lines;
        },
        // 28. Random Spiral Lines
        'Random Spiral Lines': (width, height, params) => {
            const { numberOfSpirals, maxTurns, spacing } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];

            for (let s = 0; s < numberOfSpirals; s++) {
                const turns = Math.random() * maxTurns;
                const spiralSpacing = spacing;
                const points = [];
                const numberOfPoints = turns * 100;
                for (let i = 0; i < numberOfPoints; i++) {
                    const angle = (i / numberOfPoints) * turns * 2 * Math.PI;
                    const radius = spiralSpacing * angle;
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    points.push({ x, y });
                }
                // Convert points to lines
                for (let i = 0; i < points.length - 1; i++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[i].x, y: points[i].y },
                            { x: points[i + 1].x, y: points[i + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 29. Gradient Circles
        'Gradient Circles': (width, height, params) => {
            const { numberOfCircles, radiusStep, startRadius } = params;
            const centerX = width / 2;
            const centerY = height / 2;
            const lines = [];

            for (let r = startRadius; r < startRadius + radiusStep * numberOfCircles; r += radiusStep) {
                const points = [];
                const numberOfPoints = 100;
                for (let i = 0; i <= numberOfPoints; i++) {
                    const angle = (i / numberOfPoints) * 2 * Math.PI;
                    const x = centerX + r * Math.cos(angle);
                    const y = centerY + r * Math.sin(angle);
                    points.push({ x, y });
                }
                // Convert points to lines
                for (let i = 0; i < points.length - 1; i++) {
                    lines.push({
                        id: uuidv4(),
                        points: [
                            { x: points[i].x, y: points[i].y },
                            { x: points[i + 1].x, y: points[i + 1].y },
                        ],
                    });
                }
            }

            return lines;
        },
        // 30. Additional Placeholder Algorithm
        'Algorithm 30': (width, height, params) => {
            // This is a placeholder algorithm that doesn't generate any lines
            return [];
        },
    };

    // Fill up to 30 algorithms with placeholders if necessary
    const existingAlgorithmCount = Object.keys(algorithmParameters).length;
    for (let i = existingAlgorithmCount; i < 30; i++) {
        const algoName = `Algorithm ${i + 1}`;
        if (!algorithmParameters[algoName]) {
            algorithmParameters[algoName] = [
                { name: `param1`, label: `Parameter 1`, type: 'number', default: 0 },
                { name: `param2`, label: `Parameter 2`, type: 'number', default: 0 },
                { name: `param3`, label: `Parameter 3`, type: 'number', default: 0 },
            ];

            // Define a placeholder algorithm that does nothing
            algorithms[algoName] = (width, height, params) => {
                return [];
            };
        }
    }

    // Define color sets with 25 sets (15 existing + 10 new)
    const colorSets = {
        'Sunset': [
            '#FF5E5B', '#D8A47F', '#FFE66D', '#4ECDC4', '#1A535C',
            '#FF6B6B', '#C44D58', '#F7FFF7', '#84A59D', '#F2E394',
        ],
        'Ocean': [
            '#03396C', '#005B96', '#6497B1', '#B3CDE0', '#03396C',
            '#005B96', '#6497B1', '#B3CDE0', '#03396C', '#005B96',
        ],
        'Forest': [
            '#2E8B57', '#228B22', '#6B8E23', '#556B2F', '#66CDAA',
            '#8FBC8F', '#20B2AA', '#008B8B', '#008080', '#00CED1',
        ],
        'Pastel': [
            '#FFD1DC', '#FFB347', '#77DD77', '#AEC6CF', '#CFCFC4',
            '#FF6961', '#FDFD96', '#CB99C9', '#F49AC2', '#FFFACD',
        ],
        'Vibrant': [
            '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF',
            '#4B0082', '#8B00FF', '#FF1493', '#00CED1', '#FFD700',
        ],
        'Monochrome': [
            '#000000', '#1C1C1C', '#383838', '#555555', '#707070',
            '#8C8C8C', '#A8A8A8', '#C4C4C4', '#E0E0E0', '#FFFFFF',
        ],
        'Autumn': [
            '#A52A2A', '#DEB887', '#D2691E', '#FF7F50', '#CD853F',
            '#FFA07A', '#FA8072', '#F4A460', '#D2B48C', '#BC8F8F',
        ],
        'Neon': [
            '#FF6EC7', '#FFB347', '#FF6961', '#77DD77', '#AEC6CF',
            '#CFCFC4', '#FF7F50', '#F49AC2', '#FFFACD', '#B19CD9',
        ],
        'Earth': [
            '#8B4513', '#A0522D', '#D2691E', '#CD853F', '#F4A460',
            '#DEB887', '#D2B48C', '#BC8F8F', '#FFE4B5', '#FFDEAD',
        ],
        'Candy': [
            '#FF69B4', '#FFB6C1', '#FFA07A', '#20B2AA', '#87CEFA',
            '#778899', '#B0C4DE', '#ADD8E6', '#FF6347', '#FF4500',
        ],
        'Galaxy': [
            '#1B263B', '#415A77', '#778DA9', '#E0E1DD', '#E27D60',
            '#85DCB', '#00B4D8', '#FF6347', '#FFD700', '#FF4500',
        ],
        'Aurora': [
            '#00FFAB', '#1EFFD1', '#00BFFF', '#FF00FF', '#FF1493',
            '#9400D3', '#4B0082', '#8A2BE2', '#FF69B4', '#BA55D3',
        ],
        'Retro': [
            '#FFBF00', '#FF7F50', '#87CEFA', '#DA70D6', '#32CD32',
            '#FF6347', '#40E0D0', '#FF1493', '#1E90FF', '#FFD700',
        ],
        'Candy Pop': [
            '#FF69B4', '#FFB6C1', '#FFD700', '#ADFF2F', '#87CEFA',
            '#FF7F50', '#FF4500', '#DA70D6', '#32CD32', '#20B2AA',
        ],
        'Sunrise': [
            '#FF7E5F', '#FEB47B', '#FFCC70', '#F3E1A9', '#C0D6DF',
            '#7EC8E3', '#4CA1AF', '#00A8CC', '#FF6F91', '#C94C4C',
        ],
        // Adding 10 More Artistic Elegant Color Sets
        'Elegant Blues': [
            '#0F4C81', '#1A5276', '#2980B9', '#3498DB', '#5DADE2',
            '#85C1E9', '#AED6F1', '#D6EAF8', '#EBF5FB', '#D0ECE7',
        ],
        'Sophisticated Purples': [
            '#4B0082', '#6A0DAD', '#8A2BE2', '#9932CC', '#BA55D3',
            '#DA70D6', '#EE82EE', '#D8BFD8', '#DDA0DD', '#FF00FF',
        ],
        'Elegant Greens': [
            '#145A32', '#196F3D', '#239B56', '#28B463', '#2ECC71',
            '#58D68D', '#82E0AA', '#A9DFBF', '#ABEBC6', '#D5F5E3',
        ],
        'Classic Reds': [
            '#800000', '#B22222', '#C0392B', '#E74C3C', '#FF0000',
            '#FF5733', '#FF6F61', '#FF7F50', '#FF8C00', '#FFA07A',
        ],
        'Golden Elegance': [
            '#B7950B', '#F1C40F', '#F39C12', '#E67E22', '#D4AC0D',
            '#F7DC6F', '#FAD7A0', '#F8C471', '#F5CBA7', '#FDEBD0',
        ],
        'Soft Neutrals': [
            '#F5F5F5', '#ECECEC', '#DCDCDC', '#C0C0C0', '#A9A9A9',
            '#808080', '#696969', '#778899', '#B0C4DE', '#D3D3D3',
        ],
        'Royal Colors': [
            '#2E4053', '#1F618D', '#2874A6', '#21618C', '#1A5276',
            '#0E6655', '#117A65', '#138D75', '#148F77', '#17A589',
        ],
        'Soft Pastels': [
            '#FFB6C1', '#FF69B4', '#FFDAB9', '#E6E6FA', '#D8BFD8',
            '#FFDEAD', '#F5DEB3', '#FFE4B5', '#FFFACD', '#E0FFFF',
        ],
        'Rich Browns': [
            '#8B4513', '#A0522D', '#CD853F', '#D2691E', '#B8860B',
            '#DEB887', '#F4A460', '#D2B48C', '#C68642', '#A0522D',
        ],
        'Minty Fresh': [
            '#98FB98', '#90EE90', '#00FA9A', '#3CB371', '#2E8B57',
            '#66CDAA', '#8FBC8F', '#20B2AA', '#008B8B', '#008080',
        ],
        'Elegant Grays': [
            '#2F4F4F', '#696969', '#808080', '#A9A9A9', '#BEBEBE',
            '#C0C0C0', '#D3D3D3', '#DCDCDC', '#F5F5F5', '#FFFFFF',
        ],
    };

    // Function to generate color based on index and selected color set
    const getColor = (index) => {
        const colors = colorSets[selectedColorSet] || colorSets['Sunset'];
        return colors[index % colors.length];
    };

    // Function to split the main surface using polylines
    const splitSurface = () => {
        if (polylines.length === 0) {
            // If no polylines, return the main polygon as a single polygon
            return [
                [
                    { x: 0, y: 0 },
                    { x: width, y: 0 },
                    { x: width, y: height },
                    { x: 0, y: height },
                ],
            ];
        }

        // Initialize Clipper
        const scale = 100; // Scaling factor for Clipper (handles integer coordinates)
        const mainPolygon = [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: height },
            { x: 0, y: height },
        ];

        // Scale up the main polygon
        const subj = scaleUpPath(mainPolygon, scale);

        // Initialize Clipper
        const clipper = new ClipperLib.Clipper();

        // Add the main polygon as the subject
        clipper.AddPath(subj, ClipperLib.PolyType.ptSubject, true);

        // For each polyline, create a clipping path
        polylines.forEach((line) => {
            // To split, convert the line into a very thin polygon
            const lineWidth = 1; // Thickness of the splitting line
            const dx = line.points[1].x - line.points[0].x;
            const dy = line.points[1].y - line.points[0].y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const offset = (lineWidth / 2) * scale;

            // Avoid division by zero
            if (length === 0) return;

            const normX = dy / length;
            const normY = -dx / length;

            const path = [
                {
                    x: line.points[0].x + normX * (offset / scale),
                    y: line.points[0].y + normY * (offset / scale),
                },
                {
                    x: line.points[1].x + normX * (offset / scale),
                    y: line.points[1].y + normY * (offset / scale),
                },
                {
                    x: line.points[1].x - normX * (offset / scale),
                    y: line.points[1].y - normY * (offset / scale),
                },
                {
                    x: line.points[0].x - normX * (offset / scale),
                    y: line.points[0].y - normY * (offset / scale),
                },
            ];

            // Scale up the clipping path
            const scaledClip = scaleUpPath(path, scale);

            // Add the clipping path to Clipper
            clipper.AddPath(scaledClip, ClipperLib.PolyType.ptClip, true);
        });

        // Execute the difference operation to split the polygon
        const solutionPaths = new ClipperLib.Paths();
        const succeeded = clipper.Execute(
            ClipperLib.ClipType.ctDifference,
            solutionPaths,
            ClipperLib.PolyFillType.pftNonZero,
            ClipperLib.PolyFillType.pftNonZero
        );

        if (!succeeded) {
            console.error('Failed to split the surface with the given polylines.');
            return [];
        }

        // Convert solution paths to scaled-down polygons
        const polygons = [];

        solutionPaths.forEach((path) => {
            // Ensure the path has points
            if (path && path.length > 0) {
                const scaled = scaleDownPath(path, scale);
                polygons.push(scaled);
            }
        });

        // Debugging: Log the polygons
        console.log('SubSurfaces:', polygons);

        return polygons;
    };

    // Helper function to scale up the path coordinates
    const scaleUpPath = (path, scale) => {
        return path.map((point) => ({
            X: Math.round(point.x * scale),
            Y: Math.round(point.y * scale),
        }));
    };

    // Helper function to scale down the path coordinates
    const scaleDownPath = (path, scale) => {
        return path.map((point) => ({
            x: point.X / scale,
            y: point.Y / scale,
        }));
    };

    // Memoize the splitSurface function to optimize performance
    const subSurfaces = useMemo(() => splitSurface(), [width, height, polylines]);

    // Handle algorithm selection
    const handleAlgorithmChange = (e) => {
        const algo = e.target.value;
        setSelectedAlgorithm(algo);
        if (algorithmParameters[algo]) {
            // Initialize parameters with default values
            const initialParams = {};
            algorithmParameters[algo].forEach((param) => {
                initialParams[param.name] = param.default;
            });
            setParameters(initialParams);
        } else {
            setParameters({});
        }
    };

    // Handle parameter input changes
    const handleParameterChange = (e, paramName) => {
        const value =
            e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        setParameters((prev) => ({
            ...prev,
            [paramName]: value,
        }));
    };

    // Function to handle algorithm execution
    const handleAlgorithmGenerate = () => {
        if (!selectedAlgorithm) {
            alert('Please select an algorithm from the dropdown menu.');
            return;
        }

        const generator = algorithms[selectedAlgorithm];
        if (generator) {
            const generatedLines = generator(width, height, parameters);
            if (generatedLines.length === 0) {
                alert('Selected algorithm did not generate any lines.');
            }
            setPolylines((prev) => [...prev, ...generatedLines]);
        } else {
            alert(`Selected algorithm "${selectedAlgorithm}" is not defined.`);
        }
    };

    // Function to clear the board
    const clearBoard = () => {
        setPolylines([]);
    };

    // Function to export SVG as JPG
    const exportAsJPG = () => {
        const svgElement = svgRef.current;
        if (!svgElement) {
            alert('SVG element not found!');
            return;
        }

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            // Create a canvas with the same dimensions as the SVG
            const canvas = document.createElement('canvas');
            canvas.width = width + 100; // Including padding
            canvas.height = height + 100;
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the image
            ctx.drawImage(img, 0, 0);

            // Convert canvas to JPG
            const jpgUrl = canvas.toDataURL('image/jpeg', 1.0);

            // Create a link and trigger download
            const link = document.createElement('a');
            link.href = jpgUrl;
            link.download = 'drawing.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Release memory
            URL.revokeObjectURL(url);
        };
        img.src = url;
    };

    return (
        <div style={{ display: 'flex', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            {/* Left Column: Controls */}
            <div style={{ width: '400px', marginRight: '20px' }}>
                <h2>Controls</h2>

                {/* Dashboard: Count of Pieces */}
                <div style={{ marginBottom: '20px' }}>
                    <h3>Dashboard</h3>
                    <p>
                        <strong>Number of Pieces:</strong> {subSurfaces.length}
                    </p>
                </div>

                {/* Surface Size Controls */}
                <div style={{ marginBottom: '20px' }}>
                    <h3>Surface Size</h3>
                    <form>
                        <div style={{ marginBottom: '10px' }}>
                            <label>
                                Width (px):
                                <input
                                    type="number"
                                    value={width}
                                    onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                                    min="100"
                                    max="2000"
                                    style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                                />
                            </label>
                        </div>
                        <div>
                            <label>
                                Height (px):
                                <input
                                    type="number"
                                    value={height}
                                    onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                                    min="100"
                                    max="1000"
                                    style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                                />
                            </label>
                        </div>
                    </form>
                </div>

                {/* Algorithm Selection */}
                <div style={{ marginBottom: '20px' }}>
                    <h3>Select Algorithm</h3>
                    <select
                        value={selectedAlgorithm}
                        onChange={handleAlgorithmChange}
                        style={{ width: '100%', padding: '5px' }}
                    >
                        <option value="">-- Select an Algorithm --</option>
                        {Object.keys(algorithmParameters).map((algoName, index) => (
                            <option key={index} value={algoName}>
                                {algoName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Dynamic Parameter Controls */}
                {selectedAlgorithm && (
                    <div style={{ marginBottom: '20px' }}>
                        <h3>Parameters</h3>
                        <form>
                            {algorithmParameters[selectedAlgorithm].map((param) => (
                                <div key={param.name} style={{ marginBottom: '10px' }}>
                                    <label>
                                        {param.label}:
                                        {param.type === 'text' ? (
                                            <textarea
                                                value={parameters[param.name]}
                                                onChange={(e) => handleParameterChange(e, param.name)}
                                                style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                                            />
                                        ) : param.type === 'color' ? (
                                            <input
                                                type={param.type}
                                                value={parameters[param.name]}
                                                onChange={(e) => handleParameterChange(e, param.name)}
                                                style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                                            />
                                        ) : (
                                            <input
                                                type={param.type}
                                                value={parameters[param.name]}
                                                onChange={(e) => handleParameterChange(e, param.name)}
                                                style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                                            />
                                        )}
                                    </label>
                                </div>
                            ))}
                        </form>
                        <button onClick={handleAlgorithmGenerate} style={{ width: '100%', padding: '10px' }}>
                            Generate Lines
                        </button>
                    </div>
                )}

                {/* Color Set Selection */}
                <div style={{ marginBottom: '20px' }}>
                    <h3>Select Color Set</h3>
                    <select
                        value={selectedColorSet}
                        onChange={(e) => setSelectedColorSet(e.target.value)}
                        style={{ width: '100%', padding: '5px' }}
                    >
                        {Object.keys(colorSets).map((setName, index) => (
                            <option key={index} value={setName}>
                                {setName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Clear Board Button */}
                <div style={{ marginBottom: '20px' }}>
                    <button
                        onClick={clearBoard}
                        style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#ff4d4d',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        Clear Board
                    </button>
                </div>

                {/* Export Screenshot Button */}
                <div style={{ marginBottom: '20px' }}>
                    <button
                        onClick={exportAsJPG}
                        style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        Export as JPG
                    </button>
                </div>
            </div>

            {/* Right Column: Drawing Board */}
            <div>
                <h2>Drawing Board</h2>
                <svg
                    ref={svgRef}
                    width={width + 100}
                    height={height + 100}
                    style={{
                        border: '1px solid black',
                        backgroundColor: '#f9f9f9',
                    }}
                >
                    {/* Translate the SVG to add padding */}
                    <g transform="translate(50, 50)">
                        {/* Main Surface */}
                        <rect
                            x={0}
                            y={0}
                            width={width}
                            height={height}
                            fill="lightgray"
                            stroke="black"
                            strokeWidth="2"
                        />

                        {/* Render Sub-Surfaces */}
                        {subSurfaces &&
                            Array.isArray(subSurfaces) &&
                            subSurfaces.map((polygon, index) =>
                                Array.isArray(polygon) ? (
                                    <polygon
                                        key={index}
                                        points={polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                                        fill={getColor(index)}
                                        stroke="black"
                                        strokeWidth="1"
                                        opacity="0.6"
                                    />
                                ) : null
                            )}

                        {/* Render Polylines */}
                        {polylines.map((line) =>
                            line.color ? (
                                <line
                                    key={line.id}
                                    x1={line.points[0].x}
                                    y1={line.points[0].y}
                                    x2={line.points[1].x}
                                    y2={line.points[1].y}
                                    stroke={line.color}
                                    strokeWidth="2"
                                />
                            ) : (
                                <line
                                    key={line.id}
                                    x1={line.points[0].x}
                                    y1={line.points[0].y}
                                    x2={line.points[1].x}
                                    y2={line.points[1].y}
                                    stroke="black"
                                    strokeWidth="2"
                                />
                            )
                        )}
                    </g>
                </svg>
            </div>
        </div>
    );
};

// Helper function to scale up the path coordinates
const scaleUpPath = (path, scale) => {
    return path.map((point) => ({
        X: Math.round(point.x * scale),
        Y: Math.round(point.y * scale),
    }));
};

// Helper function to scale down the path coordinates
const scaleDownPath = (path, scale) => {
    return path.map((point) => ({
        x: point.X / scale,
        y: point.Y / scale,
    }));
};

export default SplitSurface;
