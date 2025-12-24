import { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateImgData } from "@/redux/imageDataSlice";
import { Icon } from "@iconify/react";

const ScreenCapture = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLiveProcessing, setIsLiveProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const dispatch = useDispatch();
  const ocr = useSelector((state) => state.ocr);

  useEffect(() => {
    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError("Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Edge.");
    }
    
    return () => {
      stopScreenCapture();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startScreenCapture = async () => {
    console.log("Starting screen capture...");
    setError(null);
    
    // Check if getDisplayMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError("Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Edge.");
      return;
    }

    try {
      console.log("Requesting display media...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          cursor: "never" // Don't show cursor in capture
        }
      });
      
      console.log("Screen sharing started successfully", stream);
      
      // Small delay to ensure React has rendered the video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log("Setting isStreaming to true");
          setIsStreaming(true);
          setError(null);

          // Wait for video to be ready and then confirm streaming
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded, confirming streaming state");
            console.log("Video dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
          };

          // Handle when user stops sharing via browser UI
          stream.getVideoTracks()[0].addEventListener('ended', () => {
            console.log("Screen sharing ended by user");
            setIsStreaming(false);
            stopLiveProcessing();
          });
        } else {
          console.error("videoRef.current is still null after timeout");
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing screen:", err);
      if (err.name === 'NotAllowedError') {
        setError("Screen sharing permission denied. Please allow screen sharing to continue.");
      } else if (err.name === 'NotSupportedError') {
        setError("Screen sharing is not supported in this browser.");
      } else {
        setError(`Unable to start screen sharing: ${err.message}`);
      }
    }
  };

  const stopScreenCapture = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
    stopLiveProcessing();
  };

  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !ocr.worker || isProcessing) return;

    console.log("Processing frame...");
    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Convert canvas to data URL and process with OCR
      const imageData = canvas.toDataURL('image/png');
      console.log("Starting OCR recognition...");
      const { data: { text } } = await ocr.worker.recognize(imageData);
      
      console.log("OCR Result:", text);
      console.log("Text length:", text.length);
      console.log("Trimmed text length:", text.trim().length);
      
      // Update extracted text regardless of length for debugging
      if (text.trim().length > 0) {
        console.log("Setting extracted text:", text.trim());
        setExtractedText(text.trim());
      } else {
        console.log("No meaningful text found");
      }
    } catch (error) {
      console.error("OCR processing error:", error);
    } finally {
      setIsProcessing(false);
      console.log("Frame processing complete");
    }
  };

  const startLiveProcessing = () => {
    if (!ocr.worker) {
      setError("OCR worker not ready. Please wait a moment and try again.");
      return;
    }
    
    setIsLiveProcessing(true);
    setExtractedText("");
    
    // Process frame every 2 seconds to avoid overwhelming the OCR
    intervalRef.current = setInterval(processFrame, 2000);
  };

  const stopLiveProcessing = () => {
    setIsLiveProcessing(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const useExtractedText = () => {
    if (extractedText.trim()) {
      dispatch(updateImgData({ 
        step: "isExtracted", 
        extractedCode: extractedText,
        name: `live-capture-${Date.now()}.txt`
      }));
    }
  };



  if (error) {
    return (
      <div className="max-w-5xl my-3 mx-auto flex flex-col items-center justify-center px-6 py-10">
        <Icon icon="material-symbols:screen-share" className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-lg font-medium mb-2 text-red-600">Screen Sharing Error</h3>
        <p className="text-gray-600 text-center mb-4">{error}</p>
        <button
          onClick={startScreenCapture}
          className="px-4 py-2 bg-cta hover:bg-primary text-white rounded-md font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }



  return (
    <div className="max-w-5xl my-3 mx-auto flex flex-col items-center justify-center px-6 py-5">
      <h3 className="text-lg font-medium mb-4">Live Screen OCR</h3>
      
      {/* Debug info */}
      <div className="mb-4 text-xs text-gray-500">
        Status: {isStreaming ? '🟢 Streaming' : '⚪ Not streaming'} | 
        OCR: {isLiveProcessing ? '🟢 Active' : '⚪ Inactive'} | 
        Worker: {ocr.worker ? '✓ Ready' : '⏳ Loading...'} | 
        Video: {videoRef.current?.srcObject ? '✓ Has stream' : '✗ No stream'}
      </div>
      
      {/* Debug button */}
      <button 
        onClick={() => {
          console.log("Debug - isStreaming:", isStreaming);
          console.log("Debug - videoRef.current:", videoRef.current);
          console.log("Debug - videoRef.current.srcObject:", videoRef.current?.srcObject);
          console.log("Debug - video dimensions:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
        }}
        className="mb-4 px-2 py-1 text-xs bg-gray-200 rounded"
      >
        Debug State
      </button>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Video Stream */}
        <div className="order-1">
          <div className="relative w-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-auto border border-gray-300 rounded-lg bg-black ${!isStreaming ? 'hidden' : ''}`}
              style={{ maxHeight: "400px" }}
            />
            
            {/* Placeholder when not streaming */}
            {!isStreaming && (
              <div className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50">
                <Icon icon="material-symbols:screen-share" className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-gray-600 text-center mb-2">
                  Start screen sharing for live OCR
                </p>
                <p className="text-sm text-gray-500 text-center max-w-md">
                  Select your screen, window, or browser tab to begin
                </p>
              </div>
            )}
            
            {/* Processing indicator */}
            {isLiveProcessing && isStreaming && (
              <div className="absolute top-4 left-4 bg-green-500/80 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-300 animate-pulse' : 'bg-green-300'}`}></div>
                {isProcessing ? 'Processing...' : 'Live OCR Active'}
              </div>
            )}
            
            {/* Frame overlay */}
            {isStreaming && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-lg"></div>
              </div>
            )}
          </div>
        </div>

        {/* Extracted Text */}
        <div className="order-2">
          <h4 className="text-md font-medium mb-3">Extracted Text (Live)</h4>
          <div className="w-full h-64 border border-gray-300 rounded-lg p-4 bg-gray-50 overflow-y-auto">
            {extractedText ? (
              <pre className="text-sm whitespace-pre-wrap font-mono">{extractedText}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Icon icon="material-symbols:text-fields" className="w-12 h-12 mb-2" />
                <p className="text-center">
                  {isLiveProcessing ? 'Waiting for text...' : 'Start live processing to see extracted text'}
                </p>
              </div>
            )}
          </div>
          
          {extractedText && (
            <button
              onClick={useExtractedText}
              className="mt-3 w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold"
            >
              Use This Text
            </button>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={() => {
            console.log("Button clicked, isStreaming:", isStreaming);
            if (isStreaming) {
              stopScreenCapture();
            } else {
              startScreenCapture();
            }
          }}
          className="px-6 py-3 bg-cta hover:bg-primary text-white rounded-md font-semibold flex items-center gap-2"
        >
          <Icon 
            icon={isStreaming ? "material-symbols:stop-screen-share" : "material-symbols:screen-share"} 
            className="w-5 h-5" 
          />
          {isStreaming ? "Stop Sharing" : "Start Screen Sharing"}
        </button>
        
        {isStreaming && (
          <button
            onClick={isLiveProcessing ? stopLiveProcessing : startLiveProcessing}
            disabled={!ocr.worker}
            className="px-6 py-3 border border-cta text-cta hover:bg-cta hover:text-white rounded-md font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icon 
              icon={isLiveProcessing ? "material-symbols:pause" : "material-symbols:play-arrow"} 
              className="w-5 h-5" 
            />
            {isLiveProcessing ? "Stop Live OCR" : "Start Live OCR"}
          </button>
        )}
      </div>

      <div className="mt-4 text-center max-w-2xl">
        <p className="text-xs text-gray-600 mb-2">
          Share your screen, then start live OCR processing. The system will continuously analyze your screen and extract any text it finds. 
          Position code or text within the dashed frame for best results.
        </p>
        
        {!isStreaming && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> When you click "Start Screen Sharing", your browser will show a dialog to select which screen, window, or browser tab to share. 
              Make sure to select the window containing the code you want to extract.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenCapture;