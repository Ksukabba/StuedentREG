// Talks to the Google Apps Script backend (Code.gs). API_URL is set in js/config.js
function api(action,payload){
return fetch(API_URL,{method:'POST',body:JSON.stringify(Object.assign({action},payload))}).then(r=>r.json())}
const $=id=>document.getElementById(id);
const st=$('state'),lg=$('lga');
Object.keys(LGAS).sort().forEach(s=>st.add(new Option(s,s)));
st.onchange=()=>{lg.length=0;if(!st.value){lg.add(new Option('Select state first',''));lg.disabled=true;return}
lg.add(new Option('Select LGA',''));LGAS[st.value].split(',').forEach(l=>lg.add(new Option(l,l)));lg.disabled=false};
['phone','guardian'].forEach(i=>$(i).oninput=e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,11));
const phoneOk=p=>/^0[789][01]\d{8}$/.test(p);
const rules={
surname:v=>v.length>=2||'Enter your surname',
otherNames:v=>v.length>=2||'Enter your other names',
dob:v=>(v&&v<new Date().toISOString().slice(0,10))||'Choose a valid date of birth',
gender:v=>!!v||'Select your gender',
state:v=>!!v||'Select your state of origin',
lga:v=>!!v||'Select your LGA',
phone:v=>phoneOk(v)||'Enter a valid 11-digit Nigerian number (e.g. 08012345678)',
email:v=>/^[^\s@]+@[^\s@]+\.com$/i.test(v)||'Email must be valid and end with .com',
programme:v=>!!v||'Select your programme',
guardian:v=>phoneOk(v)||'Enter a valid 11-digit phone number'};
let JAMB='',ENTRY='UTME';
function setupLogin(fid,iid,eid,bid,mode){
const inp=$(iid);
inp.oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,14);
$(fid).onsubmit=e=>{e.preventDefault();const v=inp.value.trim(),er=$(eid),b=$(bid);
if(!/^\d{12}[A-Z]{2}$/.test(v)){er.textContent='Enter a valid JAMB registration number.';return}
er.textContent='';b.disabled=true;b.textContent='Checking...';
api('check',{jamb:v,mode}).then(r=>{b.disabled=false;b.textContent='Continue';
if(r.ok){JAMB=v;ENTRY=mode;$('loginPage').style.display='none';$('dePage').style.display='none';$('formPage').style.display='block';
$('jambTag').textContent=(mode==='DE'?'Direct Entry | ':'')+'JAMB No: '+v;scrollTo(0,0)}else er.textContent=r.msg})
.catch(()=>{b.disabled=false;b.textContent='Continue';er.textContent='Network error. Please try again.'})}}
setupLogin('lf','jamb','jerr','lbtn','UTME');
setupLogin('df','jambDe','derr','dbtn','DE');
$('toDe').onclick=()=>{$('loginPage').style.display='none';$('dePage').style.display='block';scrollTo(0,0)};
$('toUtme').onclick=()=>{$('dePage').style.display='none';$('loginPage').style.display='block';scrollTo(0,0)};
const DOCS=[['admissionLetter','JAMB Admission Letter'],['jambResult','Original JAMB Result'],['oLevel','O Level Result'],['stateOfOrigin','State of Origin Certificate'],['birthCert','Birth Certificate'],['acceptanceReceipt','Acceptance Fee Receipt'],['feesReceipt','School Fees Receipt'],['passport','Passport Photograph (JPG/PNG)']];
DOCS.forEach(([k,l],i)=>$('docs').insertAdjacentHTML('beforeend','<label for="d_'+k+'">'+(i+1)+'. '+l+'</label><input type="file" id="d_'+k+'" accept="'+(k==='passport'?'image/jpeg,image/png':'application/pdf,image/jpeg,image/png')+'"><div class="err" id="e_'+k+'"></div>'));
function checkFiles(){let ok=true;DOCS.forEach(([k,l])=>{const f=$('d_'+k).files[0];let m='';
if(!f)m='Please upload this document';
else if(!/^(application\/pdf|image\/(jpeg|png))$/.test(f.type)||(k==='passport'&&f.type==='application/pdf'))m=k==='passport'?'Upload a JPG or PNG photo':'Only PDF, JPG or PNG files are allowed';
else if(f.type==='application/pdf'&&f.size>1048576)m='PDF must be 1MB or less';
else if(f.size>15728640)m='Image is too large (max 15MB)';
$('e_'+k).textContent=m;if(m)ok=false});return ok}
function prepFile(k){return new Promise((res,rej)=>{const f=$('d_'+k).files[0],MAX=1048576;
const done=(blob,mime)=>{const fr=new FileReader();fr.onload=()=>res({mime,b64:fr.result.split(',')[1]});fr.onerror=()=>rej({msg:'Could not read file'});fr.readAsDataURL(blob)};
if(f.type==='application/pdf'||f.size<=MAX)return done(f,f.type);
const img=new Image(),u=URL.createObjectURL(f);
img.onload=()=>{URL.revokeObjectURL(u);let dim=1800,q=.8;
const attempt=()=>{const s=Math.min(1,dim/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
c.toBlob(b=>{if(b.size<=MAX*.95)return done(b,'image/jpeg');if(dim<=700)return rej({msg:f.name+' is too large. Please use a smaller file.'});dim=Math.round(dim*.8);q=Math.max(.5,q-.1);attempt()},'image/jpeg',q)};attempt()};
img.onerror=()=>rej({msg:'Could not read '+f.name});img.src=u})}
async function sendAll(d){const btn=$('btn');
btn.textContent='Checking...';let r=await api('precheck',{data:d});if(!r.ok)throw r;
d.docs={};
for(let i=0;i<DOCS.length;i++){const k=DOCS[i][0];btn.textContent='Uploading document '+(i+1)+' of '+DOCS.length+'...';
const f=await prepFile(k);r=await api('upload',{jamb:JAMB,mode:ENTRY,doc:k,mime:f.mime,data:f.b64});if(!r.ok)throw r;d.docs[k]=r.url}
btn.textContent='Submitting...';r=await api('submit',{data:d});if(!r.ok)throw r;return r}
let STEP=1;
function collect(){let ok=true,d={};
Object.keys(rules).forEach(k=>{const el=$(k),v=el.value.trim(),r=rules[k](v);d[k]=v;
el.parentNode.querySelector('#'+k+' + .err').textContent=r===true?'':r;if(r!==true)ok=false});
d.matric=$('matric').value.trim();d.jamb=JAMB;d.entry=ENTRY;return ok?d:null}
function show(n){STEP=n;$('step1').style.display=n===1?'block':'none';$('step2').style.display=n===2?'block':'none';$('top').textContent='';scrollTo(0,0)}
$('next').onclick=()=>{const d=collect();if(!d){$('top').textContent='Please correct the highlighted fields.';return}
const b=$('next'),t='Next: Upload documents';b.disabled=true;b.textContent='Checking...';$('top').textContent='';
api('precheck',{data:d}).then(r=>{b.disabled=false;b.textContent=t;if(r.ok)show(2);else $('top').textContent=r.msg})
.catch(()=>{b.disabled=false;b.textContent=t;$('top').textContent='Network error. Please try again.'})};
$('back').onclick=()=>show(1);
$('f').onsubmit=e=>{e.preventDefault();if(STEP===1){$('next').click();return}
const d=collect();if(!d){show(1);$('top').textContent='Please correct the highlighted fields.';return}
if(!checkFiles()){$('top').textContent='Please upload all eight documents.';return}
$('top').textContent='';$('btn').disabled=true;$('btn').textContent='Submitting...';
sendAll(d).then(()=>{$('f').style.display='none';$('done').style.display='block';scrollTo(0,0)})
.catch(e=>{$('top').textContent=(e&&e.msg)||'Network error. Please try again.';$('btn').disabled=false;$('btn').textContent='Submit registration'})};
