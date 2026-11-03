const KEY = 'attendease_v2';
const $ = s => document.querySelector(s);
const today = () => new Date().toISOString().slice(0,10);
const initials = n => n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function seed(){
  const names = ['Rashedur Zaman','Arian Hasan','Mahmudul Hasan','Kazi Saif Hossain Emon','Din Mohammad','Omar Faruk Shaon','Mahidul Islam','Mahbub Hossain','Shahriar Sabraj'];
  return {
    students: names.map((n,i)=>({id:'NU-230'+(i+1),name:n,dept:'Computer Science & Engineering'})),
    courses: [
      {code:'CSE-530219',name:'Software Engineering',schedule:'1:30–2:20 PM'},
      {code:'CSE-530223',name:'Embedded System',schedule:'2:30–3:20 PM'},
      {code:'CSE-530221',name:'Computer Networking',schedule:'3:30–4:20 PM'}
    ],
    sessions: []
  };
}
let db;
try { db = JSON.parse(localStorage.getItem(KEY)) } catch(e){}
if(!db) db = seed();
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(db)) }catch(e){} };
function toast(m){ const t=document.createElement('div'); t.className='toast'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),2200); }

const course = c => db.courses.find(x=>x.code===c);
const pct = (p,t) => t ? Math.round(p/t*100) : 0;
function sessStats(list){
  let p=0,a=0,l=0;
  list.forEach(s=>Object.values(s.rec).forEach(v=>{ v==='Present'?p++:v==='Absent'?a++:l++ }));
  return {p,a,l,total:p+a+l,rate:pct(p+l,p+a+l)};
}

/* ---------- auth ---------- */
$('#loginForm').addEventListener('submit', e=>{
  e.preventDefault();
  if($('#tid').value.trim()==='teacher' && $('#tpw').value==='1234'){
    sessionStorage.setItem('ae_in','1'); enter();
  } else $('#loginErr').textContent='Wrong teacher ID or password. Try teacher / 1234.';
});
$('#logout').onclick = () => { sessionStorage.removeItem('ae_in'); location.reload(); };
function enter(){ $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); go('dashboard'); }
$('#nav').addEventListener('click', e=>{ const p=e.target.dataset.p; if(p) go(p); });

/* ---------- router ---------- */
const titles={dashboard:'Dashboard',attendance:'Take Attendance',students:'Students',courses:'Courses',report:'Semester Report'};
function go(p){
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
  $('#crumb').textContent=titles[p];
  ({dashboard,attendance,students,courses,report})[p]();
  window.scrollTo(0,0);
}

/* ---------- dashboard ---------- */
function dashboard(){
  const st = sessStats(db.sessions);
  const recent = [...db.sessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  $('#view').innerHTML = `
  <div class="top"><div><h2>Dashboard overview</h2><p class="sub">Here is your class attendance at a glance.</p></div>
    <button class="btn" onclick="go('attendance')">+ Take attendance</button></div>
  <div class="stats">
    <div class="card stat"><span>Total students</span><b>${db.students.length}</b><span>Enrolled in your class</span></div>
    <div class="card stat"><span>My courses</span><b>${db.courses.length}</b><span>Assigned courses</span></div>
    <div class="card stat"><span>Classes recorded</span><b>${db.sessions.length}</b><span>Attendance sessions</span></div>
    <div class="card stat"><span>Average attendance</span><b>${st.rate}%</b><span>Across recorded sessions</span></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>Course overview <button class="link" onclick="go('courses')">Manage courses</button></h3>
      ${db.courses.map(c=>{const ss=db.sessions.filter(s=>s.course===c.code);const x=sessStats(ss);
        return `<div class="course"><div class="row"><div><b>${esc(c.name)}</b><div class="sub">${esc(c.code)} · ${esc(c.schedule)}</div></div><span class="pct">${x.rate}%</span></div>
        <div class="bar"><i style="width:${x.rate}%"></i></div><div class="sub">${ss.length} sessions recorded</div></div>`}).join('')}
    </div>
    <div class="card"><h3>Recent attendance <button class="link" onclick="go('report')">View report</button></h3>
      ${recent.length? recent.map(s=>{const v=Object.values(s.rec);const pr=v.filter(x=>x!=='Absent').length;
        return `<div class="course row"><div><b>${esc(course(s.course)?.name||s.course)}</b><div class="sub">${s.date}</div></div><span class="pct">${pr}/${v.length} present</span></div>`}).join('') : '<p class="empty">No sessions yet.</p>'}
    </div>
  </div>
  <div class="card"><h3>Class information <span class="pct">Current semester</span></h3>
    <div class="info"><div><small>Teacher</small><b>Saleh Muhammad Maruf</b></div><div><small>Department</small><b>Computer Science &amp; Engineering</b></div><div><small>Semester</small><b>6th Semester</b></div></div></div>`;
}

/* ---------- take attendance ---------- */
let draft = {};
function attendance(){
  $('#view').innerHTML = `
  <div class="top"><div><h2>Take attendance</h2><p class="sub">Mark each student as present, absent or late.</p></div></div>
  <div class="card">
    <p class="sub" style="margin-bottom:16px">Choose a course and date. Mark every student, then save the attendance session. You can update a saved session later.</p>
    <div class="toolbar">
      <select id="aCourse">${db.courses.map(c=>`<option value="${c.code}">${esc(c.name)} (${c.code})</option>`).join('')}</select>
      <input type="date" id="aDate" value="${today()}">
      <button class="ghost btn" id="aLoad">Load records</button>
      <button class="link" id="aAll">Mark all present</button>
    </div>
    <div id="aList"></div>
  </div>`;
  $('#aLoad').onclick = loadSession;
  $('#aAll').onclick = () => { db.students.forEach(s=>draft[s.id]='Present'); drawList(); };
  loadSession();
}
function loadSession(){
  const c=$('#aCourse').value, d=$('#aDate').value;
  const ex=db.sessions.find(s=>s.course===c&&s.date===d);
  draft = ex ? {...ex.rec} : {};
  drawList(!!ex);
}
function drawList(existing){
  const c=$('#aCourse').value, d=$('#aDate').value;
  if(existing===undefined) existing = !!db.sessions.find(s=>s.course===c&&s.date===d);
  $('#aList').innerHTML = `
    <div class="row" style="margin-bottom:8px"><b>${esc(course(c).name)} · ${d}</b><span class="sub">${db.students.length} students${existing?' · saved session':''}</span></div>
    <div class="table-wrap"><table><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>CURRENT STATUS</th><th>MARK STATUS</th></tr></thead><tbody>
    ${db.students.map(s=>{const v=draft[s.id];return `<tr><td><div class="who"><i>${initials(s.name)}</i>${esc(s.name)}</div></td><td>${s.id}</td>
      <td><span class="tag ${v||''}">${v||'Not marked'}</span></td>
      <td><div class="seg">${['Present','Absent','Late'].map(x=>`<button class="${x} ${v===x?'on':''}" data-id="${s.id}" data-v="${x}">${x}</button>`).join('')}</div></td></tr>`}).join('')}
    </tbody></table></div>
    <div style="text-align:right;margin-top:18px"><button class="btn" id="aSave">Save attendance</button></div>`;
  $('#aList').querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{draft[b.dataset.id]=b.dataset.v;drawList(existing)});
  $('#aSave').onclick = () => {
    if(db.students.some(s=>!draft[s.id])) return toast('Mark every student before saving.');
    const i=db.sessions.findIndex(s=>s.course===c&&s.date===d);
    const rec={...draft};
    if(i>=0) db.sessions[i].rec=rec; else db.sessions.push({course:c,date:d,rec});
    save(); toast('Attendance saved'); drawList(true);
  };
}

/* ---------- students ---------- */
function students(){
  $('#view').innerHTML = `
  <div class="top"><div><h2>Student directory</h2><p class="sub">Manage students enrolled in this class.</p></div><button class="btn" id="addS">+ Add student</button></div>
  <div class="card"><div class="toolbar"><input id="q" placeholder="Search by name or ID"><span class="pct" id="cnt"></span></div><div id="sList"></div></div>`;
  $('#addS').onclick = addStudent;
  $('#q').oninput = drawStudents; drawStudents();
}
function drawStudents(){
  const q=$('#q').value.toLowerCase();
  const list=db.students.filter(s=>s.name.toLowerCase().includes(q)||s.id.toLowerCase().includes(q));
  $('#cnt').textContent=list.length+' students';
  $('#sList').innerHTML = list.length? `<div class="table-wrap"><table><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>DEPARTMENT</th><th>ACTION</th></tr></thead><tbody>
    ${list.map(s=>`<tr><td><div class="who"><i>${initials(s.name)}</i>${esc(s.name)}</div></td><td>${esc(s.id)}</td><td>${esc(s.dept)}</td><td><button class="danger" data-id="${s.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No students match your search.</p>';
  $('#sList').querySelectorAll('.danger').forEach(b=>b.onclick=()=>{
    if(!confirm('Remove this student and their attendance records?')) return;
    db.students=db.students.filter(s=>s.id!==b.dataset.id);
    db.sessions.forEach(s=>delete s.rec[b.dataset.id]);
    save(); drawStudents(); toast('Student removed');
  });
}
function modal(title, fields, onOk){
  const m=document.createElement('div'); m.className='modal';
  m.innerHTML=`<form class="card"><h3>${title}</h3>${fields.map((f,i)=>`<label>${f[0]}</label><input name="f${i}" value="${f[1]||''}" required>`).join('')}
  <p class="err"></p><div class="row" style="margin-top:14px;justify-content:flex-end"><button type="button" class="btn ghost">Cancel</button><button class="btn">Save</button></div></form>`;
  document.body.appendChild(m);
  m.querySelector('.ghost').onclick=()=>m.remove();
  m.querySelector('form').onsubmit=e=>{e.preventDefault();const v=fields.map((_,i)=>m.querySelector(`[name=f${i}]`).value.trim());const err=onOk(v);if(err)m.querySelector('.err').textContent=err;else m.remove();};
  m.querySelector('input').focus();
}
function addStudent(){
  modal('Add student',[['Full name'],['Student ID'],['Department','Computer Science & Engineering']],v=>{
    if(db.students.some(s=>s.id===v[1])) return 'That student ID already exists.';
    db.students.push({name:v[0],id:v[1],dept:v[2]}); save(); drawStudents(); toast('Student added');
  });
}

/* ---------- courses ---------- */
function courses(){
  $('#view').innerHTML = `
  <div class="top"><div><h2>Courses</h2><p class="sub">Courses assigned to you this semester.</p></div><button class="btn" id="addC">+ Add course</button></div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>COURSE</th><th>CODE</th><th>SCHEDULE</th><th>SESSIONS</th><th>ACTION</th></tr></thead><tbody>
  ${db.courses.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.code)}</td><td>${esc(c.schedule)}</td><td>${db.sessions.filter(s=>s.course===c.code).length}</td><td><button class="danger" data-c="${c.code}">Remove</button></td></tr>`).join('')}
  </tbody></table></div></div>`;
  $('#addC').onclick=()=>modal('Add course',[['Course name'],['Course code'],['Schedule','1:30–2:20 PM']],v=>{
    if(db.courses.some(c=>c.code===v[1])) return 'That course code already exists.';
    db.courses.push({name:v[0],code:v[1],schedule:v[2]}); save(); courses(); toast('Course added');
  });
  document.querySelectorAll('.danger').forEach(b=>b.onclick=()=>{
    if(!confirm('Remove this course and its attendance sessions?')) return;
    db.courses=db.courses.filter(c=>c.code!==b.dataset.c);
    db.sessions=db.sessions.filter(s=>s.course!==b.dataset.c);
    save(); courses();
  });
}

/* ---------- report ---------- */
function report(){
  $('#view').innerHTML = `
  <div class="top"><div><h2>Semester attendance report</h2><p class="sub">Review attendance performance throughout the semester.</p></div><button class="link noprint" onclick="window.print()">Print report</button></div>
  <div class="toolbar noprint">
    <select id="rCourse">${db.courses.map(c=>`<option value="${c.code}">${esc(c.name)} (${c.code})</option>`).join('')}</select>
    <select id="rStu"><option value="">All students</option>${db.students.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
  </div><div id="rOut"></div>`;
  $('#rCourse').onchange=$('#rStu').onchange=drawReport; drawReport();
}
function drawReport(){
  const c=$('#rCourse').value, sid=$('#rStu').value;
  const ss=db.sessions.filter(s=>s.course===c);
  const stu=db.students.filter(s=>!sid||s.id===sid);
  const rows=stu.map(s=>{
    let p=0,a=0,l=0;
    ss.forEach(x=>{const v=x.rec[s.id]; if(v==='Present')p++; else if(v==='Absent')a++; else if(v==='Late')l++;});
    return {s,p,a,l,rate:pct(p+l,p+a+l)};
  });
  const tot=rows.reduce((t,r)=>({p:t.p+r.p,a:t.a+r.a,l:t.l+r.l}),{p:0,a:0,l:0});
  const n=tot.p+tot.a+tot.l, mx=Math.max(tot.p,tot.a,tot.l,1);
  $('#rOut').innerHTML = `
  <div class="stats">
    <div class="card stat"><span>Sessions recorded</span><b>${ss.length}</b></div>
    <div class="card stat"><span>Overall attendance</span><b>${pct(tot.p+tot.l,n)}%</b></div>
    <div class="card stat"><span>Attendance entries</span><b>${n}</b></div>
  </div>
  <div class="card" style="margin-bottom:16px"><h3>Attendance by student <span class="sub">${ss.length} sessions</span></h3>
  <div class="table-wrap"><table><thead><tr><th>STUDENT</th><th>PRESENT</th><th>ABSENT</th><th>LATE</th><th>ATTENDANCE RATE</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td><div class="who"><i>${initials(r.s.name)}</i>${esc(r.s.name)}</div></td><td>${r.p}</td><td>${r.a}</td><td>${r.l}</td><td class="rate" style="color:${r.rate>=75?'var(--ok)':'var(--bad)'}">${r.rate}%</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="card"><h3>Attendance distribution</h3>
  ${[['Present',tot.p,'var(--ok)'],['Absent',tot.a,'var(--bad)'],['Late',tot.l,'var(--late)']].map(d=>`<div class="dist"><span>${d[0]}</span><div class="bar"><i style="width:${d[1]/mx*100}%;background:${d[2]}"></i></div><b>${d[1]}</b></div>`).join('')}</div>`;
}

if(sessionStorage.getItem('ae_in')) enter();
