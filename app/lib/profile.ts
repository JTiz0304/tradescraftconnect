export const employmentOptions = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'weekends', label: 'Weekends' },
] as const

export const tradeOptions = [
  'Plumber',
  'Electrician',
  'HVAC Technician',
  'Carpenter',
  'General Contractor',
  'Remodeling Contractor',
  'Roofer',
  'Painter',
  'Drywall Installer',
  'Flooring Installer',
  'Tile Setter',
  'Cabinetmaker',
  'Millworker',
  'Mason',
  'Concrete Contractor',
  'Welder',
  'Sheet Metal Worker',
  'Glazier',
  'Insulation Installer',
  'Siding Installer',
  'Landscaper',
  'Irrigation Technician',
  'Excavation Operator',
  'Heavy Equipment Operator',
  'Pool & Spa Technician',
  'Solar Installer',
  'Fire Protection Technician',
  'Low Voltage Technician',
  'Locksmith',
  'Pest Control Technician',
  'Appliance Technician',
  'Handyman',
  'General Laborer',
] as const

export const availabilityLabels: Record<string, string> = {
  not_listed: 'Not listed',
  available_now: 'Available now',
  available_soon: 'Available soon',
  not_available: 'Not available',
}

export const verificationLabels: Record<string, string> = {
  unverified: 'Not submitted',
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Needs attention',
}

export type UserType = 'gc_builder' | 'business_owner' | 'professional' | 'apprentice'

export type MemberProfile = {
  id: string
  user_type: UserType
  full_name: string | null
  email: string | null
  location: string | null
  avatar_url: string | null
  company_name: string | null
  business_name: string | null
  trade_type: string | null
  hiring_radius: string | null
  work_radius: string | null
  school_program: string | null
  hire_abroad: boolean
  bio: string | null
  years_experience: number | null
  license_number: string | null
  license_state: string | null
  license_verification_status: string
  availability_status: string
  employment_types: string[]
  union_preference: string
  tools_equipment: string | null
  references_summary: string | null
  social_url: string | null
  video_intro_url: string | null
  apprentice_hours: number | null
  seeking_ojt: boolean
}

export function calculateProfileCompletion(profile: Partial<MemberProfile>) {
  const common = [
    profile.full_name,
    profile.location,
    profile.avatar_url,
    profile.bio,
  ]

  const roleFields: unknown[] = profile.user_type === 'gc_builder'
    ? [profile.company_name, profile.hiring_radius]
    : profile.user_type === 'business_owner'
      ? [profile.business_name, profile.trade_type, profile.work_radius]
      : profile.user_type === 'professional'
        ? [profile.trade_type, profile.work_radius, profile.years_experience, profile.availability_status]
        : [profile.trade_type, profile.school_program, profile.apprentice_hours, profile.availability_status]

  const values = [...common, ...roleFields]
  const complete = values.filter(value => {
    if (typeof value === 'number') return value >= 0
    return Boolean(value && value !== 'not_listed')
  }).length

  return Math.round((complete / values.length) * 100)
}
