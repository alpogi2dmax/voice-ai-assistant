import express from 'express'
import multer from 'multer'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { OpenAI } from 'openai'
import dotenv from 'dotenv'
import gTTSpkg from 'gtts'
const gTTS = gTTSpkg.default || gTTSpkg

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Helper to promisify exec
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    const oldPath = req.file.path
    const wavPath = `${oldPath}.wav`

    console.log('Converting webm to wav...')
    // Convert webm (likely Opus codec) to wav for Whisper
    await execPromise(`ffmpeg -i ${oldPath} -ar 16000 -ac 1 ${wavPath}`)

    console.log('Calling OpenAI Whisper API...')
    // Transcribe wav file with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavPath), // buffer works too
      model: 'whisper-1',
      // format: 'text' // optional, default json with `text` property
    })
    const userText = transcription.text
    console.log('Transcription:', userText)

    // Get GPT chat completion
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: userText }],
    })
    const reply = chatCompletion.choices[0].message.content
    console.log('GPT reply:', reply)

    // Text-to-speech with gtts
    const filename = `reply-${Date.now()}.mp3`
    const filepath = path.join(__dirname, '..', 'uploads', filename)

    await new Promise((resolve, reject) => {
      const tts = new gTTS(reply)
      tts.save(filepath, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

    // Clean up uploaded and converted files
    await fsp.unlink(oldPath)
    await fsp.unlink(wavPath)

    // Respond with transcription, GPT reply, and audio URL
    res.json({
      transcript: userText,
      reply,
      audioUrl: `/uploads/${filename}`, // serve static folder
    })
  } catch (error) {
    console.error('Error in /api/voice:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router