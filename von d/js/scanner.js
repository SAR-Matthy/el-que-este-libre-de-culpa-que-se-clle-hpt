// Scanner functionality
document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const startScannerBtn = document.getElementById('start-scanner');
    const captureBtn = document.getElementById('capture-image');
    const video = document.getElementById('scanner-video');
    const canvas = document.getElementById('scanner-canvas');
    const resultContainer = document.getElementById('result-container');
    const scannerBtns = document.querySelectorAll('.scanner-btn');

    // Variables
    let currentStream = null;
    let currentMode = 'id'; // Default mode
    let classifier = null;
    let objectDetector = null;
    let isScanning = false;

    // Set up canvas context
    const ctx = canvas.getContext('2d');

    // Initialize scanner mode buttons
    scannerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            scannerBtns.forEach(b => b.classList.remove('active'));

            // Add active class to clicked button
            btn.classList.add('active');

            // Set current mode
            currentMode = btn.dataset.mode;

            // Update scanner instructions
            updateScannerInstructions();
        });
    });

    // Update scanner instructions based on mode
    function updateScannerInstructions() {
        const instructions = document.querySelector('.scanner-instructions');

        switch (currentMode) {
            case 'id':
                instructions.textContent = 'Posiciona la tarjeta ID en el centro';
                break;
            case 'product':
                instructions.textContent = 'Posiciona el producto médico en el centro';
                break;
            case 'code':
                instructions.textContent = 'Posiciona el código de barras o QR en el centro';
                break;
        }
    }

    // Start scanner
    startScannerBtn.addEventListener('click', async () => {
        if (isScanning) {
            stopScanner();
            startScannerBtn.textContent = 'Iniciar Escáner';
            captureBtn.disabled = true;
            isScanning = false;
        } else {
            try {
                await startScanner();
                startScannerBtn.textContent = 'Detener Escáner';
                captureBtn.disabled = false;
                isScanning = true;

                // Initialize appropriate detector based on mode
                initializeDetector();
            } catch (error) {
                console.error('Error starting scanner:', error);
                showResult(`<p class="error-message">Error al iniciar la cámara: ${error.message}</p>`);
            }
        }
    });

    // Capture image
    captureBtn.addEventListener('click', () => {
        if (!isScanning) return;

        // Draw current video frame to canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Process the image based on current mode
        processImage();
    });

    // Start camera
    async function startScanner() {
        const constraints = {
            video: {
                facingMode: 'environment', // Use back camera if available
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        // Stop any existing stream
        if (currentStream) {
            stopScanner();
        }

        // Start new stream
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;

        // Wait for video to be ready
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });
    }

    // Stop camera
    function stopScanner() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            video.srcObject = null;
        }
    }

    // Initialize appropriate detector based on mode
    function initializeDetector() {
        showResult('<p>Inicializando detector... Por favor espere.</p>');

        switch (currentMode) {
            case 'id':
                // Use image classification for ID cards
                if (!classifier) {
                    classifier = ml5.imageClassifier('MobileNet', () => {
                        showResult('<p>Detector listo. Capture una imagen para analizar.</p>');
                    });
                } else {
                    showResult('<p>Detector listo. Capture una imagen para analizar.</p>');
                }
                break;

            case 'product':
                // Use object detection for medical products
                if (!objectDetector) {
                    objectDetector = ml5.objectDetector('cocossd', () => {
                        showResult('<p>Detector listo. Capture una imagen para analizar.</p>');
                    });
                } else {
                    showResult('<p>Detector listo. Capture una imagen para analizar.</p>');
                }
                break;

            case 'code':
                // Initialize Quagga for barcode scanning
                showResult('<p>Detector de códigos listo. Capture una imagen para analizar.</p>');
                break;
        }
    }

    // Process captured image based on current mode
    function processImage() {
        showResult('<p>Procesando imagen...</p>');

        switch (currentMode) {
            case 'id':
                // Classify ID card
                if (classifier) {
                    classifier.classify(canvas, (error, results) => {
                        if (error) {
                            console.error('Error classifying image:', error);
                            showResult(`<p class="error-message">Error al analizar la imagen: ${error.message}</p>`);
                            return;
                        }

                        displayIDResults(results);
                    });
                }
                break;

            case 'product':
                // Detect objects (medical products)
                if (objectDetector) {
                    objectDetector.detect(canvas, (error, results) => {
                        if (error) {
                            console.error('Error detecting objects:', error);
                            showResult(`<p class="error-message">Error al detectar objetos: ${error.message}</p>`);
                            return;
                        }

                        displayProductResults(results);
                    });
                }
                break;

            case 'code':
                // Process barcode/QR code
                processBarcode();
                break;
        }
    }

    // Process barcode/QR code
    function processBarcode() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        Quagga.decodeSingle({
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_39_vin_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader"
                ]
            },
            locate: true,
            src: canvas.toDataURL()
        }, function (result) {
            if (result && result.codeResult) {
                const code = result.codeResult.code;
                showResult(`
                    <div class="result-item">
                        <span class="result-icon"><i class="fas fa-barcode"></i></span>
                        <span class="result-text">Código: ${code}</span>
                    </div>
                    <div class="result-item">
                        <span class="result-icon"><i class="fas fa-tag"></i></span>
                        <span class="result-text">Tipo: ${result.codeResult.format}</span>
                    </div>
                `);

                // Draw the barcode location on canvas
                if (result.box) {
                    drawBoundingBox(result.box, 'rgba(139, 0, 0, 0.8)');
                }
            } else {
                showResult('<p>No se pudo detectar ningún código. Intente nuevamente.</p>');
            }
        });
    }

    // Display ID card results
    function displayIDResults(results) {
        if (!results || results.length === 0) {
            showResult('<p>No se pudo identificar la tarjeta. Intente nuevamente.</p>');
            return;
        }

        let resultsHTML = '<h4>Tarjeta Identificada</h4>';

        results.forEach((result, index) => {
            if (index < 3) { // Show top 3 results
                const confidence = Math.round(result.confidence * 100);
                resultsHTML += `
                    <div class="result-item">
                        <span class="result-icon"><i class="fas fa-id-card"></i></span>
                        <span class="result-text">${result.label.split(',')[0]}</span>
                        <span class="result-confidence">${confidence}%</span>
                    </div>
                `;
            }
        });

        showResult(resultsHTML);
    }

    // Display product detection results
    function displayProductResults(results) {
        if (!results || results.length === 0) {
            showResult('<p>No se detectaron objetos. Intente nuevamente.</p>');
            return;
        }

        let resultsHTML = '<h4>Objetos Detectados</h4>';

        // Clear canvas and redraw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        results.forEach(result => {
            const confidence = Math.round(result.confidence * 100);

            // Draw bounding box
            drawBoundingBox(result.normalized ?
                {
                    x: result.x * canvas.width,
                    y: result.y * canvas.height,
                    width: result.width * canvas.width,
                    height: result.height * canvas.height
                } : result, 'rgba(139, 0, 0, 0.8)');

            resultsHTML += `
                <div class="result-item">
                    <span class="result-icon"><i class="fas fa-syringe"></i></span>
                    <span class="result-text">${result.label}</span>
                    <span class="result-confidence">${confidence}%</span>
                </div>
            `;
        });

        showResult(resultsHTML);
    }

    // Draw bounding box on canvas
    function drawBoundingBox(box, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.width, box.height);
        ctx.stroke();

        // Add label if available
        if (box.label) {
            ctx.fillStyle = color;
            ctx.fillRect(box.x, box.y - 20, box.width, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.fillText(box.label, box.x + 5, box.y - 5);
        }
    }

    // Show result in the result container
    function showResult(html) {
        resultContainer.innerHTML = html;
    }

    // Initialize scanner instructions
    updateScannerInstructions();
});
