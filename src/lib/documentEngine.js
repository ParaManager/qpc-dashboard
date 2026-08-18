export const CANONICAL_TYPES = {
  PHOTO: 'Photo',
  PASSPORT: 'Original Passport',
  MISSION_PASSPORT: 'Mission Passport',
  QID: 'Qatar ID',
  BIRTH_CERT: 'Birth Certificate',
  MEDICAL_CERT: 'Medical Certificate',
  MEDICAL_REPORT: 'Medical Report',
  QSS_REG: 'QSS Registration',
  QSRSN: 'QSRSN Membership',
  HEALTH_CARD: 'Health Card',
  MDF: 'MDF',
  IPC: 'IPC Athlete Eligibility Agreement',
  SDMS: 'SDMS License',
  ADEL_CERT: 'ADEL Certificate',
  OTHER: 'Other',
}

export const SHARED_TYPES = [CANONICAL_TYPES.PHOTO, CANONICAL_TYPES.PASSPORT, CANONICAL_TYPES.QID]

const TYPE_ALIASES = { 'Passport': CANONICAL_TYPES.PASSPORT }
export function normalizeType(rawType) {
  return TYPE_ALIASES[rawType] || rawType
}

// Only nationality + sport_category. Mission Passport is NOT a stored/
// derived type — it's a presence check applied inside getAthleteDocumentRules.
export function classifyAthleteType(athlete) {
  const isQatari = (athlete?.nationality || '').trim().toLowerCase() === 'qatar'
  const category = (athlete?.sport_category || '').toLowerCase()
  const isSpecialOlympics = category.includes('special olympics')
  const isParalympic = category.includes('paralympic') && !isSpecialOlympics

  if (isParalympic) return isQatari ? 'qatari_paralympic' : 'non_qatari_paralympic'
  if (isSpecialOlympics) return isQatari ? 'qatari_special_olympics' : 'non_qatari_special_olympics'
  return isQatari ? 'qatari_special_olympics' : 'non_qatari_special_olympics'
}

const BASE_REQUIRED = [
  CANONICAL_TYPES.PHOTO, CANONICAL_TYPES.PASSPORT, CANONICAL_TYPES.QID,
  CANONICAL_TYPES.BIRTH_CERT, CANONICAL_TYPES.MEDICAL_CERT, CANONICAL_TYPES.MEDICAL_REPORT,
  CANONICAL_TYPES.QSS_REG,
]
const MISSION_TRIO = [CANONICAL_TYPES.MDF, CANONICAL_TYPES.IPC, CANONICAL_TYPES.SDMS]
const ATHLETE_OPTIONAL_COMMON = [CANONICAL_TYPES.QSRSN, CANONICAL_TYPES.HEALTH_CARD, CANONICAL_TYPES.OTHER]

// hasMissionPassportDoc is the sole trigger moving MDF/IPC/SDMS between
// Required and Not Applicable, for Paralympic athletes only. Special
// Olympics athletes never require Mission Passport/MDF/IPC/SDMS.
//
// ADEL Certificate:
//   - Required for Qatari Paralympic athletes, and for ANY Paralympic
//     athlete once they have a Mission Passport on file (regardless of
//     nationality — Mission Passport status takes priority here).
//   - Optional for Non-Qatari Paralympic athletes (without Mission
//     Passport) and for all Special Olympics athletes (Qatari or not).
export function getAthleteDocumentRules(athleteType, hasMissionPassportDoc) {
  const isParalympic = athleteType === 'qatari_paralympic' || athleteType === 'non_qatari_paralympic'
  const isQatari = athleteType === 'qatari_paralympic' || athleteType === 'qatari_special_olympics'

  if (isParalympic) {
    const adelRequired = hasMissionPassportDoc || isQatari
    return hasMissionPassportDoc
      ? {
          required: [...BASE_REQUIRED, CANONICAL_TYPES.MISSION_PASSPORT, ...MISSION_TRIO, CANONICAL_TYPES.ADEL_CERT],
          optional: ATHLETE_OPTIONAL_COMMON,
          notApplicable: [],
        }
      : {
          required: adelRequired ? [...BASE_REQUIRED, CANONICAL_TYPES.ADEL_CERT] : BASE_REQUIRED,
          optional: adelRequired ? ATHLETE_OPTIONAL_COMMON : [...ATHLETE_OPTIONAL_COMMON, CANONICAL_TYPES.ADEL_CERT],
          notApplicable: [CANONICAL_TYPES.MISSION_PASSPORT, ...MISSION_TRIO],
        }
  }
  // Special Olympics (Qatari or Non-Qatari): ADEL Certificate optional.
  return {
    required: BASE_REQUIRED,
    optional: [...ATHLETE_OPTIONAL_COMMON, CANONICAL_TYPES.ADEL_CERT],
    notApplicable: [CANONICAL_TYPES.MISSION_PASSPORT, ...MISSION_TRIO],
  }
}

// ADEL Certificate: Required for Coaches/Assistant Coaches/Technical Experts
// (the "Technical Staff" bucket) and Physiotherapists/Doctors (the "Medical
// Staff" bucket) — i.e. every designation in COACH_DESIGNATIONS. Not
// applicable for every other employee designation.
const ADEL_REQUIRED_DESIGNATIONS = ['Coach', 'Assistant Coach', 'Technical Expert', 'Physiotherapist', 'Doctor']
export function getNonAthleteDocumentRules(designation) {
  const adelRequired = ADEL_REQUIRED_DESIGNATIONS.includes(designation)
  return {
    required: adelRequired ? [...SHARED_TYPES, CANONICAL_TYPES.ADEL_CERT] : [...SHARED_TYPES],
    optional: [CANONICAL_TYPES.OTHER],
    notApplicable: adelRequired ? [] : [CANONICAL_TYPES.ADEL_CERT],
  }
}

export const ALL_ATHLETE_TYPES = [
  CANONICAL_TYPES.PHOTO, CANONICAL_TYPES.PASSPORT, CANONICAL_TYPES.MISSION_PASSPORT, CANONICAL_TYPES.QID,
  CANONICAL_TYPES.BIRTH_CERT, CANONICAL_TYPES.MEDICAL_CERT, CANONICAL_TYPES.MEDICAL_REPORT, CANONICAL_TYPES.QSS_REG,
  CANONICAL_TYPES.QSRSN, CANONICAL_TYPES.HEALTH_CARD, CANONICAL_TYPES.MDF, CANONICAL_TYPES.IPC, CANONICAL_TYPES.SDMS,
  CANONICAL_TYPES.ADEL_CERT, CANONICAL_TYPES.OTHER,
]
export const ALL_NON_ATHLETE_TYPES = [...SHARED_TYPES, CANONICAL_TYPES.ADEL_CERT, CANONICAL_TYPES.OTHER]

export function mergeDocuments(sharedDocs, roleDocs, applicableTypes) {
  // Normalize BOTH collections — legacy rows can carry an un-normalized
  // type (e.g. 'Passport' instead of 'Original Passport') in either
  // person_shared_documents or the role-specific table, and comparing a
  // normalized type against an un-normalized one would treat two
  // documents of the same real type as different types (or vice versa).
  const sharedDocsNormalized = (sharedDocs || []).map(d => ({ ...d, type: normalizeType(d.type) }))

  // Cross-table dedup: some legacy rows of a shared type (Photo/Original
  // Passport/Qatar ID) live in the role-specific table instead of
  // person_shared_documents (from before uploads were routed there). A
  // role-specific row is only a duplicate REPRESENTATION of one specific
  // shared document — never "any shared document of this type" — so this
  // must match by the underlying file's identity (file_path, falling back
  // to name when file_path isn't available), not merely by type. Matching
  // by type alone was the bug: uploading a second shared-type document
  // (a genuinely separate file) made this filter remove an unrelated
  // pre-existing role-specific document of the same type, because it only
  // checked "does a shared doc of this type exist at all" rather than
  // "is this specific role-doc the same physical file as that shared doc".
  const sharedIdentityKeys = new Set(
    sharedDocsNormalized.map(d => `${d.type}::${d.file_path || d.name}`)
  )
  const roleDocsFiltered = (roleDocs || [])
    .map(d => ({ ...d, type: normalizeType(d.type) }))
    .filter(d => applicableTypes.includes(d.type))
    .filter(d => !(SHARED_TYPES.includes(d.type) && sharedIdentityKeys.has(`${d.type}::${d.file_path || d.name}`)))
  const sharedDocsFiltered = sharedDocsNormalized.filter(d => applicableTypes.includes(d.type))
  return [...sharedDocsFiltered.map(d => ({ ...d, _source: 'shared' })), ...roleDocsFiltered.map(d => ({ ...d, _source: 'role' }))]
}

export function computeCompletion(mergedDocs, rules) {
  const presentTypes = new Set(mergedDocs.map(d => d.type))
  const requiredTypes = rules.required
  const missingTypes = requiredTypes.filter(t => !presentTypes.has(t))
  const uploaded = requiredTypes.length - missingTypes.length
  const percent = requiredTypes.length > 0 ? Math.round((uploaded / requiredTypes.length) * 100) : 100
  return { total: requiredTypes.length, uploaded, percent, missingTypes }
}
