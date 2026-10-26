import JSZip from 'jszip'
import { supabase } from './supabase'
import { previewSubmissionPdf } from './printTemplates'

// Generic bulk export for ANY request form. Uses the form's own configuration
// (via previewSubmissionPdf -> buildPrintHtml) and the submission's own saved
// files, so no form-specific logic lives here.

const PAGE = 500
const BAD = /[\\/:*?"<>|\u0000-\u001f]/g

export function safeName(s, max = 80) {
  const t = String(s ?? '').replace(BAD, '_').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').trim()
  return Array.from(t).slice(0, max).join('') || ''
}

function uniqueName(name, used) {
  let n = name, i = 2
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  while (used.has(n.toLowerCase())) n = `${base} (${i++})${ext}`
  used.add(n.toLowerCase())
  return n
}

// Fetch every submission of a form (beyond the 1000-row API cap).
export async function fetchAllFormSubmissions(formId) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('request_submissions')
      .select('*, profiles(full_name, role)')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

export function submitterName(sub, form) {
  return safeName(sub.is_guest ? sub.guest_name : sub.profiles?.full_name)
    || safeName(sub.guest_name) || safeName(form?.title) || 'Submission'
}

async function fetchFilesBySubmission(ids) {
  const map = {}
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.rpc('admin_export_submission_files', { p_submission_ids: ids.slice(i, i + 200) })
    if (error) throw error
    ;(data || []).forEach(f => { (map[f.submission_id] ||= []).push(f) })
  }
  return map
}

export async function exportSubmissionsZip({ form, submissions, onProgress, isCancelled }) {
  const zip = new JSZip()
  const report = { total: submissions.length, exported: 0, missingPdf: [], missingAttachments: [], failedAttachments: 0, attachments: 0 }
  const filesMap = await fetchFilesBySubmission(submissions.map(s => s.id))
  const usedFolders = new Set()
  const formTitle = safeName(form.title) || 'Requests'

  for (let i = 0; i < submissions.length; i++) {
    if (isCancelled?.()) { report.cancelled = true; break }
    const sub = submissions[i]
    onProgress?.({ done: i, total: submissions.length, current: submitterName(sub, form) })
    const ref = safeName(sub.reference_number) || sub.id.slice(0, 8)
    const folder = uniqueName(`${submitterName(sub, form)} - ${ref}`, usedFolders)
    const dir = zip.folder(folder)
    const label = `${submitterName(sub, form)} (${ref})`

    try {
      const { blob, url, filename } = await previewSubmissionPdf(form, sub)
      URL.revokeObjectURL(url)
      dir.file(safeName(filename) || `${ref}.pdf`, blob)
    } catch (e) {
      console.error('Bulk export PDF failed', sub.id, e)
      report.missingPdf.push(label)
    }

    const files = filesMap[sub.id] || []
    if (files.length) {
      const used = new Set()
      const att = dir.folder('Attachments')
      let added = 0
      for (const f of files) {
        try {
          const { data: signed, error } = await supabase.storage.from('request-attachments').createSignedUrl(f.file_path, 600)
          if (error || !signed?.signedUrl) throw error || new Error('no url')
          const res = await fetch(signed.signedUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          att.file(uniqueName(safeName(f.file_name) || f.file_path.split('/').pop(), used), await res.blob())
          added++; report.attachments++
        } catch (e) {
          console.error('Bulk export attachment failed', f.file_path, e)
          report.failedAttachments++
          report.missingAttachments.push(`${label}: ${f.file_name || f.file_path}`)
        }
      }
      if (!added) zip.remove(`${folder}/Attachments`) // never leave an empty folder
    }
    report.exported++
  }
  onProgress?.({ done: submissions.length, total: submissions.length, current: '' })

  if (report.missingPdf.length || report.missingAttachments.length || report.cancelled) {
    const lines = ['Export report', `Form: ${form.title}`, `Exported: ${report.exported}/${report.total}`]
    if (report.cancelled) lines.push('Export was cancelled before completion.')
    if (report.missingPdf.length) lines.push('', 'Missing PDFs:', ...report.missingPdf.map(x => ` - ${x}`))
    if (report.missingAttachments.length) lines.push('', 'Missing attachments:', ...report.missingAttachments.map(x => ` - ${x}`))
    zip.file('EXPORT_REPORT.txt', '﻿' + lines.join('\n'))
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, m => onProgress?.({ zipping: true, percent: m.percent }))
  const stamp = new Date().toISOString().slice(0, 10)
  return { blob, filename: `${formTitle} - ${stamp}.zip`, report }
}
