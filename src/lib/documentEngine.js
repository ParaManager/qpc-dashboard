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
export function getAthleteDocumentRules(athleteType, hasMissionPassportDoc) {
  const isParalympic = athleteType === 'qatari_paralympic' || athleteType === 'non_qatari_paralympic'

  if (isParalympic) {
    return hasMissionPassportDoc
      ? { required: [...BASE_REQUIRED, CANONICAL_TYPES.MISSION_PASSPORT, ...MISSION_TRIO], optional: ATHLETE_OPTIONAL_COMMON, notApplicable: [] }
      : { required: BASE_REQUIRED, optional: ATHLETE_OPTIONAL_COMMON, notApplicable: [CANONICAL_TYPES.MISSION_PASSPORT, ...MISSION_TRIO] }
  }
  return { required: BASE_REQUIRED, optional: ATHLETE_OPTIONAL_COMMON, notApplicable: [CANONICAL_TYPES.MISSION_PASSPORT, ...MISSION_TRIO] }
}

export function getNonAthleteDocumentRules() {
  return { required: [...SHARED_TYPES], optional: [CANONICAL_TYPES.OTHER], notApplicable: [] }
}

export const ALL_ATHLETE_TYPES = [
  CANONICAL_TYPES.PHOTO, CANONICAL_TYPES.PASSPORT, CANONICAL_TYPES.MISSION_PASSPORT, CANONICAL_TYPES.QID,
  CANONICAL_TYPES.BIRTH_CERT, CANONICAL_TYPES.MEDICAL_CERT, CANONICAL_TYPES.MEDICAL_REPORT, CANONICAL_TYPES.QSS_REG,
  CANONICAL_TYPES.QSRSN, CANONICAL_TYPES.HEALTH_CARD, CANONICAL_TYPES.MDF, CANONICAL_TYPES.IPC, CANONICAL_TYPES.SDMS,
  CANONICAL_TYPES.OTHER,
]
export const ALL_NON_ATHLETE_TYPES = [...SHARED_TYPES, CANONICAL_TYPES.OTHER]

export function mergeDocuments(sharedDocs, roleDocs, applicableTypes) {
  const sharedTypesPresent = new Set((sharedDocs || []).map(d => d.type))
  const roleDocsFiltered = (roleDocs || [])
    .map(d => ({ ...d, type: normalizeType(d.type) }))
    .filter(d => applicableTypes.includes(d.type))
    .filter(d => !(SHARED_TYPES.includes(d.type) && sharedTypesPresent.has(d.type)))
  const sharedDocsFiltered = (sharedDocs || []).filter(d => applicableTypes.includes(d.type))
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
