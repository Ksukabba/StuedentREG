// Kogi State University, Kabba - Student Registration (2026/2027)
const SHEET_ID = '1R3Hyq2HawGkF2MkFkqfqKeoIRR14JVmZySoMSiPOdis';
const SESSION = '2026/2027';
const PROGRAMMES = ['Computer Science', 'Cyber Security']; // one sheet (tab) per programme
const DOCS = {
  admissionLetter:'JAMB Admission Letter', jambResult:'Original JAMB Result', oLevel:'O Level Result',
  stateOfOrigin:'State of Origin Certificate', birthCert:'Birth Certificate',
  acceptanceReceipt:'Acceptance Fee Receipt', feesReceipt:'School Fees Receipt', passport:'Passport Photograph'
};
const ROOT_FOLDER_NAME = 'KSU Kabba Student Credentials 2026-2027';
const MAX_BYTES = 1024 * 1024; // 1MB per document
const EXT = {'application/pdf':'pdf', 'image/jpeg':'jpg', 'image/png':'png'};
const HEADERS = ['Timestamp','Session','JAMB Reg. No.','Surname','Other Names','Date of Birth','State of Origin','LGA','Gender','Phone','Email','Programme','Matric No.','Guardian Contact','Entry Mode'].concat(Object.keys(DOCS).map(k => DOCS[k]));
const JAMB_COL = 3, EMAIL_COL = 11;

// Backend API for the registration site hosted on GitHub Pages.
// Deploy as Web app: Execute as = Me, Who has access = Anyone.
function doGet() { return json_({ok:true, msg:'KSU registration API is running'}); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.action === 'check') return json_(checkJamb(req.jamb, req.mode));
    if (req.action === 'precheck') return json_(submitForm(req.data || {}, true));
    if (req.action === 'upload') return json_(uploadDoc(req));
    if (req.action === 'submit') return json_(submitForm(req.data || {}));
    return json_({ok:false, msg:'Unknown request.'});
  } catch (err) {
    console.error(err);
    return json_({ok:false, msg:'Server error. Please try again.'});
  }
}

function rootFolder_() {
  const p = PropertiesService.getScriptProperties(), id = p.getProperty('ROOT_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(ROOT_FOLDER_NAME);
  p.setProperty('ROOT_ID', f.getId());
  return f;
}

// Saves one uploaded document into Drive: root folder > one folder per JAMB number
function uploadDoc(req) {
  const mode = req.mode === 'DE' ? 'DE' : 'UTME';
  const jamb = String(req.jamb || '').trim().toUpperCase();
  const mime = String(req.mime || '');
  if (!jambValid_(jamb, mode)) return {ok:false, msg:'Invalid JAMB registration number.'};
  if (!DOCS[req.doc]) return {ok:false, msg:'Unknown document.'};
  if (!EXT[mime] || (req.doc === 'passport' && mime === 'application/pdf')) return {ok:false, msg:'File type not allowed.'};
  const bytes = Utilities.base64Decode(String(req.data || ''));
  if (!bytes.length || bytes.length > MAX_BYTES) return {ok:false, msg:'File is empty or too large.'};
  if (isUsed_(SpreadsheetApp.openById(SHEET_ID), JAMB_COL, jamb)) return {ok:false, msg:USED_MSG};

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let folder;
  try {
    const root = rootFolder_(), it = root.getFoldersByName(jamb);
    folder = it.hasNext() ? it.next() : root.createFolder(jamb);
  } finally { lock.releaseLock(); }

  const label = DOCS[req.doc];
  const old = folder.getFiles();
  while (old.hasNext()) { const f = old.next(); if (f.getName().indexOf(label + ' - ') === 0) f.setTrashed(true); } // re-upload replaces
  const file = folder.createFile(Utilities.newBlob(bytes, mime, label + ' - ' + jamb + '.' + EXT[mime]));
  return {ok:true, url:file.getUrl()};
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function getProgrammeSheet_(ss, name) {
  let sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  } else {
    const hr = sh.getRange(1, 1, 1, HEADERS.length), cur = hr.getValues()[0];
    if (cur.some(x => x === '')) { hr.setValues([cur.map((x, i) => x === '' ? HEADERS[i] : x)]); hr.setFontWeight('bold'); }
  }
  return sh;
}

// true if value already exists in the given column on any programme sheet
function isUsed_(ss, col, value) {
  const v = String(value).trim().toLowerCase();
  for (const name of PROGRAMMES) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) continue;
    const vals = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
    if (vals.some(r => String(r[0]).trim().toLowerCase() === v)) return true;
  }
  return false;
}

const JAMB_RE_UTME = /^202660\d{6}[A-Z]{2}$/;  // UTME: must start with 202660
const JAMB_RE_DE = /^\d{12}[A-Z]{2}$/;           // Direct Entry: any 12 digits + 2 letters
const jambValid_ = (j, mode) => (mode === 'DE' ? JAMB_RE_DE : JAMB_RE_UTME).test(j);
const USED_MSG = 'This JAMB registration number has already been used. You can only fill the form once.';

// Login step
function checkJamb(jamb, mode) {
  jamb = String(jamb || '').trim().toUpperCase();
  mode = mode === 'DE' ? 'DE' : 'UTME';
  if (!jambValid_(jamb, mode)) return {ok:false, msg:'Invalid JAMB registration number. Check and try again.'};
  if (isUsed_(SpreadsheetApp.openById(SHEET_ID), JAMB_COL, jamb)) return {ok:false, msg:USED_MSG};
  return {ok:true};
}

// Form submission
function submitForm(d, dryRun) {
  const clean = k => String(d[k] || '').trim();
  const phoneOk = p => /^0[789][01]\d{8}$/.test(p);
  const jamb = clean('jamb').toUpperCase();
  const email = clean('email').toLowerCase();
  const entry = clean('entry') === 'DE' ? 'DE' : 'UTME';
  const required = ['surname','otherNames','dob','state','lga','gender','phone','email','programme','guardian'];
  if (!jambValid_(jamb, entry)) return {ok:false, msg:'Invalid JAMB registration number. Please log in again.'};
  for (const k of required) if (!clean(k)) return {ok:false, msg:'Please fill all required fields.'};
  if (PROGRAMMES.indexOf(clean('programme')) < 0) return {ok:false, msg:'Select a valid programme.'};
  if (!phoneOk(clean('phone'))) return {ok:false, msg:'Enter a valid 11-digit Nigerian phone number.'};
  if (!phoneOk(clean('guardian'))) return {ok:false, msg:'Enter a valid 11-digit guardian phone number.'};
  if (!/^[^\s@]+@[^\s@]+\.com$/i.test(email)) return {ok:false, msg:'Email must be valid and end with .com'};
  const docs = d.docs || {};
  if (!dryRun) for (const k in DOCS) if (!/^https:\/\/drive\.google\.com\//.test(String(docs[k] || ''))) return {ok:false, msg:'Please upload all required documents.'};

  let record;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    PROGRAMMES.forEach(p => getProgrammeSheet_(ss, p));
    if (isUsed_(ss, JAMB_COL, jamb)) return {ok:false, msg:USED_MSG};
    if (isUsed_(ss, EMAIL_COL, email)) return {ok:false, msg:'This email address has already been used. Use a different email.'};
    if (dryRun) return {ok:true}; // pre-check only: nothing is saved

    const sh = getProgrammeSheet_(ss, clean('programme'));
    const row = sh.getLastRow() + 1;
    record = [
      new Date(), SESSION, jamb, clean('surname'), clean('otherNames'), clean('dob'),
      clean('state'), clean('lga'), clean('gender'), clean('phone'), email,
      clean('programme'), clean('matric'), clean('guardian'),
      entry === 'DE' ? 'Direct Entry' : 'UTME'
    ].concat(Object.keys(DOCS).map(k => String(docs[k])));
    sh.getRange(row, 2, 1, HEADERS.length - 1).setNumberFormat('@'); // keep leading zeros
    sh.getRange(row, 1, 1, HEADERS.length).setValues([record]);
  } finally { lock.releaseLock(); }

  sendConfirmation_(record); // after the lock is released; a mail failure never cancels the registration
  return {ok:true};
}

// Confirmation email with the submitted details (in the body and as a PDF attachment)
function sendConfirmation_(r) {
  try {
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const rows = [
      ['JAMB Reg. No.', r[2]], ['Surname', r[3]], ['Other Names', r[4]], ['Date of Birth', r[5]],
      ['State of Origin', r[6]], ['LGA', r[7]], ['Gender', r[8]], ['Phone Number', r[9]],
      ['Email', r[10]], ['Programme', r[11]], ['Entry Mode', r[14]], ['Matric Number', r[12] || 'Not provided'], ['Guardian Contact', r[13]]
    ];
    const table = '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
      rows.map(x => '<tr><td style="border:1px solid #b9c9b6;padding:8px;background:#eef4ec;font-weight:bold;width:40%">' +
        esc(x[0]) + '</td><td style="border:1px solid #b9c9b6;padding:8px">' + esc(x[1]) + '</td></tr>').join('') + '</table>';
    const when = Utilities.formatDate(r[0], 'Africa/Lagos', 'dd MMM yyyy, hh:mm a');
    const title = 'Kogi State University, Kabba';

    const pdfHtml = '<div style="font-family:Arial,sans-serif"><h2 style="color:#1f7a34;text-align:center;margin-bottom:2px">' + title +
      '</h2><p style="text-align:center;margin-top:0">Students Registration ' + SESSION + ' - Submission Details</p>' +
      '<p>Submitted: ' + when + '</p>' + table + '</div>';
    const pdf = HtmlService.createHtmlOutput(pdfHtml).getBlob().getAs('application/pdf')
      .setName('KSU_Registration_' + r[2] + '.pdf');

    const htmlBody = '<div style="font-family:Arial,sans-serif;max-width:600px;color:#111">' +
      '<div style="background:#1f7a34;color:#fff;padding:16px;border-bottom:4px solid #e8921a"><h2 style="margin:0">' + title + '</h2>' +
      '<div>Students Registration ' + SESSION + '</div></div>' +
      '<p>Dear ' + esc(r[3]) + ' ' + esc(r[4]) + ',</p>' +
      '<p>Your registration was <b>submitted successfully</b> on ' + when + '. Below are the details you submitted. A PDF copy is attached.</p>' +
      table + '<p>Please keep this email for your records. If any detail is wrong, contact the school Registry.</p>' +
      '<p>Kogi State University, Kabba</p></div>';

    MailApp.sendEmail({
      to: r[10],
      subject: 'Registration Successful - ' + title + ' (' + SESSION + ')',
      body: 'Your registration was submitted successfully. See the attached PDF for the details you submitted.',
      htmlBody: htmlBody,
      attachments: [pdf],
      name: 'KSU Kabba Registration'
    });
  } catch (err) {
    console.error('Confirmation email failed: ' + err);
  }
}

// Run once from the editor to grant permissions (Sheets + email)
function authorize() {
  SpreadsheetApp.openById(SHEET_ID);
  DriveApp.getRootFolder(); // asks for Drive permission
  Logger.log('Emails you can still send today: ' + MailApp.getRemainingDailyQuota());
}
