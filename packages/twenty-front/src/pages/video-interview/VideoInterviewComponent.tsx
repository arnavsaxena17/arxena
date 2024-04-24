import { AnimatePresence, motion } from "framer-motion";
import { RadioGroup } from "@headlessui/react";
import { v4 as uuid } from "uuid";
import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import axios from 'axios';

import { createFFmpeg, fetchFile, FFmpeg } from "@ffmpeg/ffmpeg";
const questions = [
  {
    id: 1,
    name: "Behavioral",
    description: "From LinkedIn, Amazon, Adobe",
    difficulty: "Easy",
  },
  {
    id: 2,
    name: "Technical",
    description: "From Google, Meta, and Apple",
    difficulty: "Medium",
  },
];

const interviewers = [
  {
    id: "John",
    name: "John",
    description: "Software Engineering",
    level: "L3",
  },
  {
    id: "Richard",
    name: "Richard",
    description: "Product Management",
    level: "L5",
  },
  {
    id: "Sarah",
    name: "Sarah",
    description: "Other",
    level: "L7",
  },
];

const ffmpeg = await createFFmpeg({
  // corePath: `http://localhost:3001/ffmpeg/dist/ffmpeg-core.js`,
  // I've included a default import above (and files in the public directory), but you can also use a CDN like this:
  corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
  log: true,
});

console.log("FFMpeg::", ffmpeg)
console.log("Checking FFMpeg::", ffmpeg.isLoaded())

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export const VideoInterviewComponent = () => {
  const [selected, setSelected] = useState(questions[0]);
  const [selectedInterviewer, setSelectedInterviewer] = useState(
    interviewers[0]
  );
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const webcamRef = useRef<Webcam | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [seconds, setSeconds] = useState(150);
  const [videoEnded, setVideoEnded] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState(true);
  const [cameraLoaded, setCameraLoaded] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("Processing");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [generatedFeedback, setGeneratedFeedback] = useState("");

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
  }, []);

  useEffect(() => {
    if (videoEnded) {
      const element = document.getElementById("startTimer");

      if (element) {
        element.style.display = "flex";
      }

      setCapturing(true);
      setIsVisible(false);

      mediaRecorderRef.current = new MediaRecorder(
        webcamRef?.current?.stream as MediaStream
      );
      mediaRecorderRef.current.addEventListener(
        "dataavailable",
        handleDataAvailable
      );
      mediaRecorderRef.current.start();
    }
  }, [videoEnded, webcamRef, setCapturing, mediaRecorderRef]);

  const handleStartCaptureClick = useCallback(() => {
    console.log("handle Start capture click")
    const startTimer = document.getElementById("startTimer");
    if (startTimer) {
      startTimer.style.display = "none";
    }

    if (vidRef.current) {
      vidRef.current.play();
    }
  }, [webcamRef, setCapturing, mediaRecorderRef]);

  const handleDataAvailable = useCallback(
    ({ data }: BlobEvent) => {
      console.log("handle data available")
      if (data.size > 0) {
        setRecordedChunks((prev) => prev.concat(data));
      }
    },
    [setRecordedChunks]
  );

  const handleStopCaptureClick = useCallback(() => {
    console.log("handle stop capture click")
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setCapturing(false);
  }, [mediaRecorderRef, webcamRef, setCapturing]);

  useEffect(() => {
    let timer: any = null;
    if (capturing) {
      timer = setInterval(() => {
        setSeconds((seconds) => seconds - 1);
      }, 1000);
      if (seconds === 0) {
        handleStopCaptureClick();
        setCapturing(false);
        setSeconds(0);
      }
    }
    return () => {
      clearInterval(timer);
    };
  });

  const handleDownload = async () => {
    console.log("Handle the download")
    if (recordedChunks.length) {
      setSubmitting(true);
      setStatus("Processing");

      const file = new Blob(recordedChunks, {
        type: `video/webm`,
      });

      const unique_id = uuid();
      console.log("Got here to handle the doanload and got uuid::", unique_id)

      // This checks if ffmpeg is loaded
      if (!ffmpeg.isLoaded()) {
        try{
          console.log("Going to try and load ffmpeg")
          await ffmpeg.load();
        }
        catch{
          console.log("Bug in loading ffmpeg");
        }
      }
      console.log("Lets see if ffmpeg works")

      // This writes the file to memory, removes the video, and converts the audio to mp3
      ffmpeg.FS("writeFile", `${unique_id}.webm`, await fetchFile(file));
      await ffmpeg.run(
        "-i",
        `${unique_id}.webm`,
        "-vn",
        "-acodec",
        "libmp3lame",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "mp3",
        `${unique_id}.mp3`
      );


      // This reads the converted file from the file system
      const fileData = ffmpeg.FS("readFile", `${unique_id}.mp3`);

      // This creates a new file from the raw data
      const output = new File([fileData.buffer], `${unique_id}.mp3`, {
        type: "audio/mp3",
      }); 

      // const formData = new FormData();
      // formData.append("operations", `{}`);
      // formData.append("map", `{}`);
      // formData.append("model", "whisper-1");
      // formData.append("file", output, `${unique_id}.mp3`);
      // formData.append("key", "");

      // formData.append('question', 'What is the question?');


      const question =
        selected.name === "Behavioral"
          ? `Tell me about yourself. Why don${`’`}t you walk me through your resume?`
          : selectedInterviewer.name === "John"
          ? "What is a Hash Table, and what is the average case and worst case time for each of its operations?"
          : selectedInterviewer.name === "Richard"
          ? "Uber is looking to expand its product line. Talk me through how you would approach this problem."
          : "You have a 3-gallon jug and 5-gallon jug, how do you measure out exactly 4 gallons?";

      setStatus("Transcribing");

      // const upload = await fetch(
      //   `http://localhost:3000/video-interview/transcribe?question=${encodeURIComponent(question)}`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "multipart/form-data",
      //     },
      //     body: formData,
      //   }
      // );
      // const results = await upload.json();


      const uploadFile = async (output: File) => {
        const formData = new FormData();

        const operations = {
          query: `
            mutation UploadFile($file: Upload!) {
              uploadFile(file: $file) {
                success
                message
              }
            }
          `,
          variables: {
            file: null,
          },
        };

        formData.append('operations', JSON.stringify(operations));

        formData.append('map', JSON.stringify({ '0': ['variables.file'] }));
  
        // Add the 'file' field after the 'map' field
        formData.append('0', output);
        
        try {
          const response = await axios.post('http://localhost:3000/video-interview/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          console.log(response.data);
          return response;
        } catch (error) {
          console.error(error);
          throw error;
        }
      };
  
      const upload = await uploadFile(output);
  
  
      if (upload.status == 200) {
        setIsSuccess(true);
        setSubmitting(false);

        const results = upload.data;

        if (results.error) {
          setTranscript(results.error);
        } else {
          setTranscript(results.transcript);
        }

        console.log("Uploaded successfully!");

        await Promise.allSettled([
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]).then(() => {
          setCompleted(true);
          console.log("Success!");
        });

        if (results.transcript.length > 0) {
          const prompt = `Please give feedback on the following interview question: ${question} given the following transcript: ${
            results.transcript
          }. ${
            selected.name === "Behavioral"
              ? "Please also give feedback on the candidate's communication skills. Make sure their response is structured (perhaps using the STAR or PAR frameworks)."
              : "Please also give feedback on the candidate's communication skills. Make sure they accurately explain their thoughts in a coherent way. Make sure they stay on topic and relevant to the question."
          } \n\n\ Feedback on the candidate's response:`;

          setGeneratedFeedback("");
          const response = await fetch("https://localhost:3000/video-interview/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt,
            }),
          });

          if (!response.ok) {
            throw new Error(response.statusText);
          }

          // This data is a ReadableStream
          const data = response.body;
          if (!data) {
            return;
          }

          const reader = data.getReader();
          const decoder = new TextDecoder();
          let done = false;

          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            const chunkValue = decoder.decode(value);
            setGeneratedFeedback((prev: any) => prev + chunkValue);
          }
        }
      } else {
        console.error("Upload failed.");
      }

      setTimeout(function () {
        setRecordedChunks([]);
      }, 1500);
    }
  };

  function restartVideo() {
    setRecordedChunks([]);
    setVideoEnded(false);
    setCapturing(false);
    setIsVisible(true);
    setSeconds(150);
  }

  const videoConstraints = isDesktop
    ? { width: 1280, height: 720, facingMode: "user" }
    : { width: 480, height: 640, facingMode: "user" };

  const handleUserMedia = () => {
    setTimeout(() => {
      setLoading(false);
      setCameraLoaded(true);
    }, 1000);
  };

  return (
    <AnimatePresence>
      {step === 3 ? (
        <div>
          <p>

          </p>
          {completed ? (
            <div>
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.35, ease: [0.075, 0.82, 0.165, 1] }}
              
              >
                <video
                
                  controls
                  crossOrigin="anonymous"
                  autoPlay
                >
                  <source
                    src={URL.createObjectURL(
                      new Blob(recordedChunks, { type: "video/mp4" })
                    )}
                    type="video/mp4"
                  />
                </video>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.5,
                  duration: 0.15,
                  ease: [0.23, 1, 0.82, 1],
                }} >
                <div>
                  <p>
                    Video is not stored on our servers, and will go away as soon
                    as you leave the page.
                  </p>
                </div>
                <Link
                  href="https://github.com/Tameyer41/liftoff"
                  target="_blank" style={{
                    boxShadow:
                      "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                  }} >
                  <span> </span>
                  Star on Github
                </Link>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.5,
                  duration: 0.15,
                  ease: [0.23, 1, 0.82, 1],
                }}>
                <div>
                  <h2>
                    Transcript
                  </h2>
                  <p>
                    {transcript.length > 0
                      ? transcript
                      : "Don't think you said anything. Want to try again?"}
                  </p>
                </div>
                <div>
                  <h2>
                    Feedback
                  </h2>
                  <div>
                    <p>
                      {generatedFeedback}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div>
              {recordingPermission ? (
                <div>
                  <h2>
                    {selected.name === "Behavioral"
                      ? `Tell me about yourself. Why don${`’`}t you walk me through your resume?`
                      : selectedInterviewer.name === "John"
                      ? "What is a Hash Table, and what is the average case and worst case time for each of its operations?"
                      : selectedInterviewer.name === "Richard"
                      ? "Uber is looking to expand its product line. Talk me through how you would approach this problem."
                      : "You have a 3-gallon jug and 5-gallon jug, how do you measure out exactly 4 gallons?"}
                  </h2>
                  <span>
                    Asked by top companies like Google, Facebook and more
                  </span>
                  <motion.div
                    initial={{ y: -20 }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.075, 0.82, 0.965, 1],
                    }}>
                    {!cameraLoaded && (
                      <div> </div>
                    )}
                    <div>
                      <div>
                        <span>
                          {new Date(seconds * 1000).toISOString().slice(14, 19)}
                        </span>
                      </div>
                      {isVisible && ( // If the video is visible (on screen) we show it
                        <div>
                          <div>
                            <video
                              id="question-video"
                              onEnded={() => setVideoEnded(true)}
                              controls={false}
                              ref={vidRef}
                              playsInline 
                              crossOrigin="anonymous"
                            >
                              <source
                                src={
                                  selectedInterviewer.name === "John"
                                    ? selected.name === "Behavioral"
                                      ? "https://liftoff-public.s3.amazonaws.com/DemoInterviewMale.mp4"
                                      : "https://liftoff-public.s3.amazonaws.com/JohnTechnical.mp4"
                                    : selectedInterviewer.name === "Richard"
                                    ? selected.name === "Behavioral"
                                      ? "https://liftoff-public.s3.amazonaws.com/RichardBehavioral.mp4"
                                      : "https://liftoff-public.s3.amazonaws.com/RichardTechnical.mp4"
                                    : selectedInterviewer.name === "Sarah"
                                    ? selected.name === "Behavioral"
                                      ? "https://liftoff-public.s3.amazonaws.com/BehavioralSarah.mp4"
                                      : "https://liftoff-public.s3.amazonaws.com/SarahTechnical.mp4"
                                    : selected.name === "Behavioral"
                                    ? "https://liftoff-public.s3.amazonaws.com/DemoInterviewMale.mp4"
                                    : "https://liftoff-public.s3.amazonaws.com/JohnTechnical.mp4"
                                }
                                type="video/mp4"
                              />
                            </video>
                          </div>
                        </div>
                      )}
                      <Webcam
                        mirrored
                        audio
                        muted
                        ref={webcamRef}
                        videoConstraints={videoConstraints}
                        onUserMedia={handleUserMedia}
                        onUserMediaError={(error) => {
                          setRecordingPermission(false);
                        }}
                      
                      />
                    </div>
                    {loading && (
                      <div>
                        <div>
                          <div>
                            Loading...
                          </div>
                        </div>
                      </div>
                    )}{cameraLoaded && (
                      <div>
                        {recordedChunks.length > 0 ? (
                          <>
                            {isSuccess ? (
                              <button
                              
                                style={{
                                  boxShadow:
                                    "0px 1px 4px rgba(27, 71, 13, 0.17), inset 0px 0px 0px 1px #5fc767, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                                }}
                              >
                              </button>
                            ) : (
                              <div>
                                {!isSubmitting && (
                                  <button onClick={() => restartVideo()} > Restart </button>
                                )}
                                <button
                                  onClick={handleDownload}
                                  disabled={isSubmitting}
                                
                                  style={{
                                    boxShadow:
                                      "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                                  }}
                                >
                                  <span>
                                    {isSubmitting ? (
                                      <div>
                                        <span>{status}</span>
                                      </div>
                                    ) : (
                                      <div>
                                        <span>Process transcript</span>                  </div>
                                    )}
                                  </span>
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div>
                            <div>
                              {capturing ? (
                                <div id="stopTimer" onClick={handleStopCaptureClick} > <div>Stop Click</div>
                                </div>
                              ) : (
                                <button
                                  id="startTimer"
                                  onClick={handleStartCaptureClick}
                                > Start Time</button>
                              )}
                              <div></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div id="countdown"
                    ></div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.5,
                      duration: 0.15,
                      ease: [0.23, 1, 0.82, 1],
                    }}
                  >
                    <p>
                      Video is not stored on our servers, it is solely used for
                      transcription.
                    </p>
                  </motion.div>
                </div>
              ) : (
                <div>
                  <motion.div
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.075, 0.82, 0.165, 1],
                    }}
                  
                  >
                    <p>
                      Camera permission is denied. We don{`'`}t store your
                      attempts anywhere, but we understand not wanting to give
                      us access to your camera. Try again by opening this page
                      in an incognito window {`(`}or enable permissions in your
                      browser settings{`)`}.
                    </p>
                  </motion.div>
                  <div>
                    <button
                      onClick={() => setStep(1)} style={{
                        boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                      }}
                    >
                      Restart demo
                    </button>
                    <Link
                      href="https://github.com/Tameyer41/liftoff"
                      target="_blank" style={{ boxShadow: "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)", }} >
                      <span>  </span>
                      Star on Github
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.25, ease: [0.23, 1, 0.32, 1] }}>

          </motion.p>
          <div>
            <div>
              {step === 1 ? (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  key="step-1"
                  transition={{
                    duration: 0.95,
                    ease: [0.165, 0.84, 0.44, 1],
                  }}
                
                >
                  <h2>
                    Select a question type
                  </h2>
                  <p>
                    We have hundreds of questions from top tech companies.
                    Choose a type to get started.
                  </p>
                  <div>

                  </div>
                  <div>
                    <div>
                      <Link
                        href="/"
                      
                        style={{
                          boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                        }}
                      >
                        Back to home
                      </Link>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setStep(2);
                        }}
                      
                        style={{
                          boxShadow:
                            "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <span> Continue </span>  </button>
                    </div>
                  </div>
                </motion.div>
              ) : step === 2 ? (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  key="step-2"
                  transition={{
                    duration: 0.95,
                    ease: [0.165, 0.84, 0.44, 1],
                  }}
                
                >
                  <h2>
                    And an interviewer
                  </h2>
                  <p>
                    Choose whoever makes you feel comfortable. You can always
                    try again with another one.
                  </p>
                  <div>

                  </div>
                  <div>
                    <div>
                      <button
                        onClick={() => setStep(1)}
                      
                        style={{
                          boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                        }}
                      >
                        Previous step
                      </button>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setStep(3);
                        }}
                      
                        style={{
                          boxShadow:
                            "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <span> Continue </span>
                     
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <p>Step 3</p>
              )}
            </div>
          </div>
          <div>  <figure
            
              style={{
                grid: "100%/repeat(1,calc(5px * 28)) 1fr",
                boxShadow:
                  "0 192px 136px rgba(26,43,59,.23),0 70px 50px rgba(26,43,59,.16),0 34px 24px rgba(26,43,59,.13),0 17px 12px rgba(26,43,59,.1),0 7px 5px rgba(26,43,59,.07), 0 50px 100px -20px rgb(50 50 93 / 25%), 0 30px 60px -30px rgb(0 0 0 / 30%), inset 0 -2px 6px 0 rgb(10 37 64 / 35%)",
              }}
            >
              <div></div>
              <div style={{ boxShadow: "inset -1px 0 0 #fff" }}
              >
                <ul>

                </ul>
                <ul>
                  <hr />
                  <li>
                    <div>
                      R
                    </div>
                    <p>
                      Richard Monroe
                    </p>
                    <div>
                    
                    </div>
                  </li>
                </ul>
              </div>
              <div>
                {step === 1 ? (
                  <div>
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                    
                    >
                      {selected.name} Questions
                    </motion.span><ul>
                      <li>
                        Search through all of the questions in the question
                        bank. If you don{`'`}t see one you{`'`}re looking for,
                        you can always add it in your the {`"`}My Questions{`"`}{" "}
                        section.
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                    
                    >
                      {selected.name === "Behavioral"
                        ? "Tell me about yourself"
                        : selectedInterviewer.name === "John"
                        ? "What is a Hash Table, and what is the average case for each of its operations?"
                        : selectedInterviewer.name === "Richard"
                        ? "Uber is looking to expand its product line. How would you go about doing this?"
                        : "You have a 3-gallon jug and 5-gallon jug, how do you measure out exactly 4 gallons?"}
                    </motion.span><ul>
                      {selected.name === "Behavioral" ? (
                        <li>
                          Start off by walking me through your resume. Perhaps
                          begin with your internships in college and move to
                          more recent projects.
                        </li>
                      ) : (
                        <li>
                          Start off by explaining what the function does, and
                          its time and space complexities. Then go into how you
                          would optimize it.
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {selectedInterviewer.name === "John" ? (
                      <motion.img
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        key="John"
                        src="/placeholders/John.webp"
                        alt="John's Interviewer Profile"
                      
                      />
                    ) : selectedInterviewer.name === "Richard" ? (
                      <motion.img
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        key="Richard"
                        src="/placeholders/Richard.webp"
                        alt="Richard's Interviewer Profile"
                      
                      />
                    ) : selectedInterviewer.name === "Sarah" ? (
                      <motion.img
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        key="Sarah"
                        src="/placeholders/Sarah.webp"
                        alt="Sarah's Interviewer Profile"
                      
                      />
                    ) : (
                      <div></div>
                    )}
                    <div></div>
                  </motion.div>
                )}
                {step === 1 && (
                  <ul>
                  <p>Search</p>
                  </ul>
                )}
                {step === 1 &&
                  (selected.name === "Behavioral" ? (
                    <motion.ul
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                    
                    >
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>Why this company?</p>
                              </div>
                              <p>
                                Why do you want to work for Google?
                              </p>
                              <div>
                                <p>
                                  Product Management
                                </p>
                                <p>
                                  <span>              </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>What are you most proud of?</p>
                              </div>
                              <p>
                                Tell me about the thing you are most proud of.
                                Why is it so important to you?
                              </p>
                              <div>
                                <p>
                                  General
                                </p>
                                <p>
                                  <span>
  
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>Tell me about yourself</p>
                              </div>
                              <p>
                                Walk me through your resume, projects, and
                                anything you feel is relevant to your story.
                              </p>
                              <div>
                                <p>
                                  Product Management
                                </p>
                                <p>
                                  <span>
    
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>What are your strengths?</p>
                              </div>
                              <p>
                                Tell me about your strengths and why you would
                                make a strong candidate.
                              </p>
                              <div>
                                <p>
                                  Software Engineering
                                </p>
                                <p>
                                  <span>              </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>What are your weaknesses?</p>
                              </div>
                              <p>
                                Tell me about your weaknesses, and how that has
                                impacted your previous work.
                              </p>
                              <div>
                                <p>
                                  Product Management
                                </p>
                                <p>
                                  <span>              </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    </motion.ul>
                  ) : (
                    <motion.ul
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                    
                    >
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>Walk me through this function</p>
                              </div>
                              <p>
                                Explain in as much detail as you can what this
                                function does, including its time and space...
                              </p>
                              <div>
                                <p>
                                  Software Engineering
                                </p>
                                <p>
                                  <span>
   
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>Uber product expansion</p>
                              </div>
                              <p>
                                Uber is looking to expand its product line and
                                wants your take on how...
                              </p>
                              <div>
                                <p>
                                  Product Management
                                </p>
                                <p>
                                  <span>              </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>Weighing an Airplane</p>
                              </div>
                              <p>
                                How would you weigh a plane without a scale?
                              </p>
                              <div>
                                <p>
                                  Brainteaser
                                </p>
                                <p>
                                  <span>              </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div>
                          <div>
                            <div></div>
                            <div>
                              <div>
                                <p>How would you rebuild Twitter?</p>
                              </div>
                              <p>
                                Given what you know about Twitter, how would you
                                architect it from the ground up?
                              </p>
                              <div>
                                <p>
                                  Systems Design
                                </p>
                                <p>
                                  <span>              </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    </motion.ul>
                  ))}
                {step === 1 && (
                  <div>
                    <nav aria-label="Pagination"
                    >
                    </nav>
                  </div>
                )}
              </div>
            </figure>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
