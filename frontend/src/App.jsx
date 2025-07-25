import { useState, useRef } from 'react'
import './App.css'

export default function App() {

  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const audioRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const startRecording = async () => {
    setTranscript('')
    setReply('')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true})
    mediaRecorderRef.current = new MediaRecorder(stream)
    audioChunksRef.current = []

    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data)
    }

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })

      const formData = new FormData()
      formData.append('audio', file)

      try {
        const response = await fetch('http://localhost:5000/api/voice', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()
        setTranscript(data.transcript)
        setReply(data.reply)

        if (data.audioUrl && audioRef.current) {
          audioRef.current.src = `http://localhost:5000${data.audioUrl}`
          audioRef.current.play()
        }
      } catch (err) {
        alert('Error communicating with backend: ' + err.message)
      }      
    }

    mediaRecorderRef.current.start()
    setRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current.stop()
    setRecording(false)
  }

  return (
    <main>
      <h1>Voice AI Assistant</h1>
      {!recording && <button onClick={startRecording}>Start Recording</button>}
      {recording && <button onClick={stopRecording}>Stop Recording</button>}

      <div style={{ marginTop: 20}}>
        <h3>Transcribed Text:</h3>
        <p>{transcript}</p>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>GPT reply:</h3>
        <p>{reply}</p>
      </div>

      <audio ref={audioRef} controls style={{marginTop: 20, width: '100%'}} />
    </main>
  )
}