export const POMODORO_SOUND = {
  start: 'start',
  complete: 'complete',
  break: 'break',
  focus: 'focus',
} as const

type PomodoroSound = (typeof POMODORO_SOUND)[keyof typeof POMODORO_SOUND]

type Tone = {
  frequency: number
  delaySeconds: number
  durationSeconds: number
  volume: number
}

const SILENT_GAIN = 0.0001
const ATTACK_SECONDS = 0.015
const AUDIO_SCHEDULE_AHEAD_SECONDS = 0.01

const SOUND_TONES = {
  [POMODORO_SOUND.start]: [
    { frequency: 440, delaySeconds: 0, durationSeconds: 0.1, volume: 0.06 },
    {
      frequency: 659.25,
      delaySeconds: 0.11,
      durationSeconds: 0.16,
      volume: 0.07,
    },
  ],
  [POMODORO_SOUND.complete]: [
    { frequency: 880, delaySeconds: 0, durationSeconds: 0.1, volume: 0.07 },
    {
      frequency: 1174.66,
      delaySeconds: 0.12,
      durationSeconds: 0.2,
      volume: 0.08,
    },
  ],
  [POMODORO_SOUND.break]: [
    {
      frequency: 659.25,
      delaySeconds: 0.38,
      durationSeconds: 0.14,
      volume: 0.06,
    },
    {
      frequency: 523.25,
      delaySeconds: 0.53,
      durationSeconds: 0.14,
      volume: 0.06,
    },
    {
      frequency: 392,
      delaySeconds: 0.68,
      durationSeconds: 0.22,
      volume: 0.07,
    },
  ],
  [POMODORO_SOUND.focus]: [
    {
      frequency: 392,
      delaySeconds: 0.38,
      durationSeconds: 0.14,
      volume: 0.06,
    },
    {
      frequency: 523.25,
      delaySeconds: 0.53,
      durationSeconds: 0.14,
      volume: 0.06,
    },
    {
      frequency: 659.25,
      delaySeconds: 0.68,
      durationSeconds: 0.22,
      volume: 0.07,
    },
  ],
} as const satisfies Record<PomodoroSound, readonly Tone[]>

let audioContext: AudioContext | null = null

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new window.AudioContext()
  }
  return audioContext
}

const scheduleTone = (context: AudioContext, baseTime: number, tone: Tone) => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const startsAt = baseTime + tone.delaySeconds
  const endsAt = startsAt + tone.durationSeconds

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(tone.frequency, startsAt)
  gain.gain.setValueAtTime(SILENT_GAIN, startsAt)
  gain.gain.exponentialRampToValueAtTime(tone.volume, startsAt + ATTACK_SECONDS)
  gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, endsAt)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startsAt)
  oscillator.stop(endsAt)
}

export const playPomodoroSound = async (sound: PomodoroSound) => {
  const context = getAudioContext()
  if (!context) return

  try {
    if (context.state === 'suspended') {
      await context.resume()
    }

    const baseTime = context.currentTime + AUDIO_SCHEDULE_AHEAD_SECONDS
    for (const tone of SOUND_TONES[sound]) {
      scheduleTone(context, baseTime, tone)
    }
  } catch {
    // Audio can be blocked by browser autoplay or device policies.
  }
}

export const disposePomodoroSounds = async () => {
  const context = audioContext
  audioContext = null
  if (!context || context.state === 'closed') return

  try {
    await context.close()
  } catch {
    // The browser may already be tearing down the audio context.
  }
}
