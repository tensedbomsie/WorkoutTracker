export type Exercise = {
  id: string
  owner: string
  name: string
  category: string
  subcategory: string | null
  muscle_group: string | null
  primary_muscle: string | null
  secondary_muscle: string | null
  equipment: string | null
  movement_pattern: string | null
  difficulty: string | null
  stretch_focus: boolean
  thumbnail_url: string | null
  notes: string | null
  is_favorite: boolean
  created_at: string
}

export type WorkoutSet = {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: number
  weight: number
  rpe: number | null
  created_at: string
}

export type WorkoutExercise = {
  id: string
  workout_id: string
  exercise_id: string
  position: number
  created_at: string
  exercise?: Exercise
  sets?: WorkoutSet[]
}

export type Workout = {
  id: string
  owner: string
  name: string
  performed_at: string
  notes: string | null
  duration_minutes: number | null
  created_at: string
  workout_exercises?: WorkoutExercise[]
}

export type PhotoAngle = 'Front' | 'Side' | 'Back'

export type ProgressPhoto = {
  id: string
  owner: string
  taken_at: string
  angle: PhotoAngle
  image_url: string
  created_at: string
}

export type BodyMeasurement = {
  id: string
  owner: string
  measured_at: string
  weight: number | null
  body_fat: number | null
  waist: number | null
  chest: number | null
  arm: number | null
  thigh: number | null
  created_at: string
}

export const CATEGORIES = [
  'Chest',
  'Back',
  'Shoulder',
  'Biceps',
  'Triceps',
  'Forearm',
  'Core',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
] as const
