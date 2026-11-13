(() => {
  'use strict';
  const KEY = 'mi-semana-v1'; // Conserva los datos de v1 al actualizar
  const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const DAY_CHOICES = [{ n: 1, s: 'L' }, { n: 2, s: 'M' }, { n: 3, s: 'X' }, { n: 4, s: 'J' }, { n: 5, s: 'V' }, { n: 6, s: 'S' }, { n: 0, s: 'D' }];
  const COLORS = [{id:'verde',label:'Verde'},{id:'dorado',label:'Dorado'},{id:'naranja',label:'Amarillo / naranja'},{id:'azul',label:'Azul'},{id:'turquesa',label:'Verde agua'},{id:'beige',label:'Beige'},{id:'morado',label:'Morado'},{id:'rosa',label:'Rosa'},{id:'gris',label:'Gris'}];
  const colorOf = x => COLORS.some(c=>c.id===x)?x:'verde';
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
  const toISO = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const fromISO = s => { const a = String(s).split('-').map(Number); return new Date(a[0],a[1]-1,a[2]); };
  const addDays = (iso,n) => {const d = fromISO(iso);d.setDate(d.getDate()+n);return toISO(d)};
  const dayDelta = (a,b) => { const d1=fromISO(a),d2=fromISO(b); return Math.round((Date.UTC(d2.getFullYear(),d2.getMonth(),d2.getDate())-Date.UTC(d1.getFullYear(),d1.getMonth(),d1.getDate()))/86400000); };
  const monday = iso => {const d=fromISO(iso);d.setDate(d.getDate()-((d.getDay()+6)%7));return toISO(d)};
  const minute = t => {const m=/^(\d{1,2}):(\d{2})$/.exec(String(t || ''));return m?Number(m[1])*60+Number(m[2]):9*60};
  const timeText = mins => String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  const defaultData = () => ({ events: [], pending: [], shopping: [], templates: [], completed: {}, skipped: {}, overrides: {}, defaultsSeededV13: false });
  // Reservas y tareas vinculadas usan el mismo almacén existente para mantener respaldos antiguos.
  const PROPERTY_MAP={biu:{name:'Biu',color:'naranja'},capechik:{name:'Capechik',color:'azul'},moroli:{name:'Moroli',color:'turquesa'},libelula:{name:'Libélula',color:'beige'}};
  const noRepeat=()=>({type:'none',every:2,days:[]});
  const cleanNumber=n=>Number.isFinite(Number(n))?Number(n):0;
  const safeClock = (clock, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(clock||'')) ? clock : fallback;
  const legacyMulti = x => eventKind(x)==='multiday' && !x.endTime;
  const multiStartTime = x => legacyMulti(x) ? '00:00' : safeClock(x?.start, '15:00');
  const multiEndTime = x => legacyMulti(x) ? '23:59' : safeClock(x?.endTime, '11:00');
  const multiFinishFraction = x => legacyMulti(x) ? 1 : minute(multiEndTime(x))/1440;
  const propertyDefaults = [
    {name:'Biu',color:'naranja',key:'biu'},
    {name:'Capechik',color:'azul',key:'capechik'},
    {name:'Moroli',color:'turquesa',key:'moroli'},
    {name:'Libélula',color:'beige',key:'libelula'}
  ];
  function addDefaultTemplates(d){
    if(d.defaultsSeededV13)return false;
    for (const property of propertyDefaults) for (const type of [{slug:'limpieza',name:'Limpieza',start:'11:00',kind:'timed',duration:60},{slug:'checkin',name:'Check-in',start:'15:00',kind:'instant',duration:0},{slug:'checkout',name:'Check-out',start:'10:00',kind:'instant',duration:0}]) {
      const title=type.name+' '+property.name;
      if(!d.templates.some(t=>t.title?.trim().toLowerCase()===title.toLowerCase()))d.templates.push({id:'predef-'+property.key+'-'+type.slug,title,start:type.start,kind:type.kind,duration:type.duration,color:property.color,repeat:{type:'none',every:2,days:[]}});
    }
    d.defaultsSeededV13=true;return true;
  }
  // Duración libre en minutos. Los registros anteriores (v1) siguen siendo válidos.
  const eventKind = x => ['instant','multiday'].includes(x?.kind) ? x.kind : 'timed';
  const durationMinutes = x => Math.max(1, Math.min(1439, Math.round(Number(x?.duration) || 60)));
  const daySpan = x => Math.max(2, Math.min(730, Math.round(Number(x?.spanDays) || 2)));
  const safeEndDate = x => x?.endDate && /^\d{4}-\d{2}-\d{2}$/.test(x.endDate) && x.endDate >= x.date ? x.endDate : addDays(x.date, daySpan(x)-1);
  function durationLabel(x) {
    const kind = eventKind(x);
    if (kind==='instant') return 'Sin duración';
    if (kind==='multiday') {
      const count = x?.endDate ? dayDelta(x.date, safeEndDate(x))+1 : daySpan(x);
      return `${count} ${count===1?'día':'días'} · ${legacyMulti(x)?'todo el día':multiStartTime(x)+' → '+multiEndTime(x)}`;
    }
    const minutes = durationMinutes(x), h=Math.floor(minutes/60), m=minutes%60;
    return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
  }
  function kindControls(kind='timed',duration=60,isTemplate=false,endDate='',spanDays=2,multiStart='15:00',multiEnd='11:00') {
    kind=eventKind({kind});const initial=Number(duration)>0?Number(duration):60,h=Math.floor(initial/60),m=initial%60;
    return `<fieldset class="task-type-field"><legend>¿Cómo quieres que aparezca?</legend>
      <div class="task-type-choices">
        <label><input type="radio" name="kind" value="timed" ${kind==='timed'?'checked':''}><span>Con duración</span></label>
        <label><input type="radio" name="kind" value="instant" ${kind==='instant'?'checked':''}><span>Recordatorio</span></label>
        <label><input type="radio" name="kind" value="multiday" ${kind==='multiday'?'checked':''}><span>Varios días</span></label>
      </div></fieldset>
      <div data-kind-area="timed" ${kind!=='timed'?'hidden':''}>
        <div class="duration-presets" aria-label="Duraciones habituales">${[10,15,30,45,60,90,120,150,180].map(n=>`<button type="button" data-duration="${n}">${n<60?n+'m':(Math.floor(n/60)+'h'+(n%60?' '+n%60+'m':''))}</button>`).join('')}</div>
        <div class="duration-edit form-row"><label class="field">Horas<input type="number" name="durationHours" inputmode="numeric" min="0" max="23" step="1" value="${h}" /></label>
          <label class="field">Minutos<input type="number" name="durationMinutes" inputmode="numeric" min="0" max="59" step="1" value="${m}" /></label></div>
      </div>
      <p class="duration-info" data-kind-area="instant" ${kind!=='instant'?'hidden':''}>Aparecerá como un aviso pequeño a la hora elegida, sin ocupar una franja larga.</p>
      <div data-kind-area="multiday" ${kind!=='multiday'?'hidden':''}>
        ${isTemplate ? `<label class="field">¿Cuántos días ocupa?<input type="number" name="spanDays" min="2" max="730" step="1" inputmode="numeric" value="${daySpan({spanDays})}" /></label>` : `<label class="field">Último día<input type="date" name="endDate" value="${esc(endDate)}" /></label>`}
        <div class="form-row"><label class="field">Hora de inicio<input type="time" name="multiStart" value="${esc(multiStart)}" /></label><label class="field">Hora de fin<input type="time" name="multiEnd" value="${esc(multiEnd)}" /></label></div>
        <p class="duration-info">La barra superior empezará y terminará según esas horas; podrás leerlas al tocarla.</p>
      </div>`;
  }
  function wireKind(form, isTemplate=false){
    function refresh(){
      const kind = form.querySelector('input[name=kind]:checked')?.value||'timed';
      form.querySelectorAll('[data-kind-area]').forEach(x=>x.hidden=x.dataset.kindArea!==kind);
      const timeField=form.querySelector('[data-time-field]');
      if(timeField)timeField.hidden=kind==='multiday';
      const recur=form.querySelector('[data-recurrence-wrap]');
      if(recur)recur.hidden=kind==='multiday';
      if(!isTemplate && kind==='multiday') {
        const end=form.elements.endDate;
        if(end && (!end.value || end.value<form.elements.date.value)) end.value=addDays(form.elements.date.value||toISO(new Date()),2);
      }
    }
    form.querySelectorAll('[data-duration]').forEach(b=>b.addEventListener('click',()=>{
      const n=Number(b.dataset.duration);form.elements.durationHours.value=Math.floor(n/60);form.elements.durationMinutes.value=n%60;
      form.querySelectorAll('[data-duration]').forEach(x=>x.classList.toggle('selected',x===b));
    }));
    form.querySelectorAll('input[name=kind]').forEach(r=>r.addEventListener('change',refresh));
    if(!isTemplate)form.elements.date.addEventListener('change',refresh);
    refresh();
  }
  function readKind(form,isTemplate=false) {
    const kind=form.querySelector('input[name=kind]:checked')?.value||'timed';
    if(kind==='instant') return {kind,duration:0};
    if(kind==='multiday'){
      const start=safeClock(form.elements.multiStart.value,'');const endTime=safeClock(form.elements.multiEnd.value,'');
      if(!start||!endTime){toast('Elige las horas de inicio y fin');return null;}
      if(isTemplate){const n=Number(form.elements.spanDays.value);if(!Number.isInteger(n)||n<2||n>730){toast('Escribe un número de días entre 2 y 730');return null;}return {kind,spanDays:n,start,endTime,duration:0}}
      const date=form.elements.date.value, endDate=form.elements.endDate.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<date){toast('La fecha final debe ser igual o posterior al inicio');form.elements.endDate.focus();return null}
      if(dayDelta(date,endDate)>729){toast('Máximo 730 días por reserva');return null;}
      if(date===endDate && minute(endTime)<=minute(start)){toast('La hora de fin debe ser posterior al inicio');return null;}
      return {kind,endDate,start,endTime,duration:0};
    }
    const hours=Number(form.elements.durationHours.value), minutes=Number(form.elements.durationMinutes.value);
    if(!Number.isInteger(hours)||hours<0||hours>23||!Number.isInteger(minutes)||minutes<0||minutes>59||hours*60+minutes<1){toast('La duración debe ser al menos 1 minuto, o elige «Recordatorio»');return null}
    return {kind:'timed',duration:hours*60+minutes};
  }

  const normalizeRepeat = rep => {
    if (!rep || !['none','interval','weekdays'].includes(rep.type)) return {type:'none',every:2,days:[]};
    return { type:rep.type, every:Math.max(1,Math.min(90,Number(rep.every)||2)), days:Array.isArray(rep.days)?rep.days.filter(d=>Number.isInteger(d)&&d>=0&&d<=6):[] };
  };
  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY)||'null');
      if (!parsed || typeof parsed !== 'object') return defaultData();
      const obj = defaultData();
      for (const arr of ['events','pending','shopping','templates']) obj[arr] = Array.isArray(parsed[arr]) ? parsed[arr].filter(x=>x && typeof x==='object') : [];
      for (const map of ['completed','skipped','overrides']) obj[map] = parsed[map] && typeof parsed[map] === 'object' && !Array.isArray(parsed[map]) ? parsed[map] : {};
      obj.defaultsSeededV13=!!parsed.defaultsSeededV13;
      return obj;
    } catch {return defaultData()}
  }
  let data = load();
  if(addDefaultTemplates(data)){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){console.warn('No se pudo guardar tareas predeterminadas',e)}}
  const ui = {view:'calendar',selectedDate:toISO(new Date()),weekStart:monday(toISO(new Date())),templateDate:toISO(new Date())};
  const dialog=$('dialog'), content=$('dialogContent');
  function save() {try {localStorage.setItem(KEY,JSON.stringify(data))} catch(e){alert('No se pudieron guardar los cambios. Exporta un respaldo y revisa el espacio disponible.')} }
  let undoSnapshot=null;
  function rememberUndo(){undoSnapshot=JSON.stringify(data)}
  function toastUndo(message){
    document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast toast-action';
    const span=document.createElement('span');span.textContent=message;
    const button=document.createElement('button');button.type='button';button.textContent='Deshacer';
    button.addEventListener('click',()=>{if(!undoSnapshot)return;data=JSON.parse(undoSnapshot);undoSnapshot=null;save();render();t.remove()});
    t.append(span,button);document.body.append(t);setTimeout(()=>t.remove(),5200);
  }
  const linkedFor = id => data.events.filter(x=>x.linkedReservationId===id);
  function syncReservationChildren(reservation){
    const p=PROPERTY_MAP[reservation.property]||{name:reservation.property||'Reserva',color:colorOf(reservation.color)};
    const base=[
      {role:'checkin',title:'Check-in '+p.name,date:reservation.date,start:multiStartTime(reservation),kind:'instant',duration:0},
      {role:'checkout',title:'Check-out '+p.name,date:safeEndDate(reservation),start:multiEndTime(reservation),kind:'instant',duration:0},
      {role:'cleaning',title:'Limpieza '+p.name,date:safeEndDate(reservation),start:reservation.cleaningTime||'11:00',kind:'timed',duration:reservation.cleaningDuration||60}
    ];
    for(const item of base){
      const existing=data.events.find(e=>e.linkedReservationId===reservation.id&&e.linkedRole===item.role);
      if(item.role==='cleaning' && reservation.includeCleaning===false){if(existing)data.events=data.events.filter(e=>e.id!==existing.id);continue}
      if(existing){if(!existing.linkedCustomized) Object.assign(existing,item,{color:reservation.color,repeat:noRepeat()});}
      else data.events.push({id:uid(),...item,color:reservation.color,repeat:noRepeat(),linkedReservationId:reservation.id,linkedRole:item.role,linkedCustomized:false});
    }
  }
  function addReservation(res){data.events.push(res);syncReservationChildren(res);save()}
  function removeReservation(res){const ids=new Set([res.id,...linkedFor(res.id).map(x=>x.id)]);data.events=data.events.filter(e=>!ids.has(e.id));for(const key of ['completed','skipped','overrides'])for(const k of Object.keys(data[key]))if(ids.has(k.split('@')[0]))delete data[key][k];save()}
  function visibleOccurrence(event,date){
    const rep=normalizeRepeat(event.repeat),base=rep.type==='none'?[event.date]:null;
    const keys=Object.entries(data.overrides).filter(([k])=>k.startsWith(event.id+'@'));
    const movingIn=keys.filter(([key,o])=>(o.date||key.split('@')[1])===date&&key.split('@')[1]!==date).map(([key,o])=>({ ...event,occDate:key.split('@')[1],displayDate:date,start:safeClock(o.start,event.start||'09:00'),duration:o.duration??event.duration }));
    const local=data.overrides[event.id+'@'+date];
    const localEvent=occurs(event,date)&&!(local?.date&&local.date!==date)?[{...event,occDate:date,displayDate:date,start:safeClock(local?.start,event.start||'09:00'),duration:local?.duration??event.duration}]:[];
    return [...localEvent,...movingIn];
  }
  function updateOccurrence(event,origDate,newDate,newTime,newDuration){
    rememberUndo();
    if(normalizeRepeat(event.repeat).type==='none' && !event.linkedReservationId){
      event.date=newDate;event.start=newTime;event.duration=newDuration;
    } else {
      const key=event.id+'@'+origDate;
      data.overrides[key]={...(data.overrides[key]||{}),date:newDate,start:newTime,duration:newDuration};
      if(event.linkedReservationId)event.linkedCustomized=true;
    }
    save();renderCalendar();toastUndo('Horario actualizado');
  }
  function repeatLabel(rep) {
    const r=normalizeRepeat(rep);
    if(r.type==='interval')return r.every===1?'Todos los días':`Cada ${r.every} días`;
    if(r.type==='weekdays')return r.days.length ? r.days.map(d=>DAY_CHOICES.find(x=>x.n===d)?.s||'').join(' · ') : 'Días personalizados';
    return 'Una vez';
  }
  function prettyDate(iso) {const d=fromISO(iso);return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;}
  function dayLong(iso) {const d=fromISO(iso);return `${DAYS[(d.getDay()+6)%7]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;}
  function occurs(event,day) {
    if (!event || !/^\d{4}-\d{2}-\d{2}$/.test(event.date||'') || day < event.date || data.skipped[event.id+'@'+day]) return false;
    if(eventKind(event)==='multiday') return day<=safeEndDate(event);
    const rep=normalizeRepeat(event.repeat);
    if (rep.type==='none') return day===event.date;
    if (rep.type==='interval') return dayDelta(event.date,day)%rep.every===0;
    return rep.days.includes(fromISO(day).getDay());
  }
  const isDone=(eventId,day)=>!!data.completed[eventId+'@'+day];
  function toast(message){document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.textContent=message;document.body.append(t);setTimeout(()=>t.remove(),2500)}
  function showDialog(html){content.innerHTML=html;if(!dialog.open)dialog.showModal();content.querySelector('[data-close]')?.addEventListener('click',closeDialog)}
  function closeDialog(){if(dialog.open)dialog.close();content.innerHTML=''}
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog()});
  dialog.addEventListener('close',()=>{if(!dialog.open)content.innerHTML='' });
  function modalHeader(text){return `<div class="modal-head"><h2>${esc(text)}</h2><button type="button" class="close-btn" data-close aria-label="Cerrar">×</button></div>`}
  function colorControls(selected='verde') {
    return `<fieldset class="palette-field"><legend>Color de la tarea</legend><div class="palette-choices">${COLORS.map(c=>`<label class="palette-choice" title="${c.label}"><input type="radio" name="color" value="${c.id}" ${colorOf(selected)===c.id?'checked':''} /><span class="palette-dot color-${c.id}"></span><span class="visually-hidden">${c.label}</span></label>`).join('')}</div></fieldset>`;
  }
  function repeatControls(rep,referenceDate) {
    const r=normalizeRepeat(rep);
    const weekday=fromISO(referenceDate).getDay();
    const days=r.days.length?r.days:[weekday];
    return `<label class="field">Repetición<select id="repeatType"><option value="none" ${r.type==='none'?'selected':''}>No se repite</option><option value="interval" ${r.type==='interval'?'selected':''}>Cada cierto número de días</option><option value="weekdays" ${r.type==='weekdays'?'selected':''}>Días específicos de la semana</option></select></label>
      <div class="recur-fields" id="recurrenceDetails" ${r.type==='none'?'hidden':''}>
        <div id="repeatInterval" ${r.type!=='interval'?'hidden':''}><label class="field">Repetir cada cuántos días<input type="number" id="repeatEvery" min="1" max="90" step="1" value="${r.every}" /></label><p class="tiny">Ejemplo: 2 = un día sí, otro no; 3 = cada tercer día.</p></div>
        <div id="repeatWeekdays" ${r.type!=='weekdays'?'hidden':''}><div class="weekday-choices">${DAY_CHOICES.map(x=>`<label class="weekday-label"><input type="checkbox" name="weekday" value="${x.n}" ${days.includes(x.n)?'checked':''} /><span>${x.s}</span></label>`).join('')}</div><p class="tiny">Se repetirá estos días a partir de la fecha inicial.</p></div>
      </div>`;
  }
  function wireRepeat(form, dateInput) {
    const type=form.querySelector('#repeatType');
    function refresh() {
      const value=type.value;
      form.querySelector('#recurrenceDetails').hidden=value==='none';
      form.querySelector('#repeatInterval').hidden=value!=='interval';
      form.querySelector('#repeatWeekdays').hidden=value!=='weekdays';
    }
    type.addEventListener('change',refresh);
    if(dateInput) dateInput.addEventListener('change',()=>{
      if (type.value==='weekdays' && !form.querySelector('input[name=weekday]:checked')) {
        const weekday=fromISO(dateInput.value||toISO(new Date())).getDay();
        const chk=form.querySelector(`input[name=weekday][value="${weekday}"]`);
        if(chk) chk.checked=true;
      }
    });
  }
  function collectRepeat(form) {
    const type=form.querySelector('#repeatType').value;
    const every=Number(form.querySelector('#repeatEvery').value);
    if(type==='interval' && (!Number.isInteger(every)||every<1||every>90)) {alert('Indica un intervalo de 1 a 90 días.');return null;}
    const days=[...form.querySelectorAll('input[name=weekday]:checked')].map(x=>Number(x.value));
    if(type==='weekdays' && days.length===0) {alert('Selecciona por lo menos un día de la semana.');return null;}
    return normalizeRepeat({type,every,days});
  }
  function renderTabs() {
    document.querySelectorAll('.tab').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.view===ui.view));
    for (const name of ['calendar','reservations','pending','shopping','templates']) $(name+'View').hidden=ui.view!==name;
    const remaining=data.pending.filter(x=>!x.done).length;
    const counter=$('pendingCount');counter.hidden=!remaining;counter.textContent=remaining>99?'99+':remaining;
  }
  function setView(view) {
    ui.view=view;render();
    if(view==='calendar') {document.querySelector('.tabs').scrollLeft=0;focusCalendarDay(ui.selectedDate);}
    window.scrollTo({top:0,behavior:'instant'});
  }
  function focusCalendarDay(date,time=null) {
    const scroller=$('calendarScroller');
    if(scroller.scrollWidth>scroller.clientWidth+4) {
      const first=scroller.querySelector('.day-col');
      const idx=Math.max(0,Math.min(6,dayDelta(ui.weekStart,date)));
      scroller.scrollLeft=Math.max(0,idx*(first?.getBoundingClientRect().width||114));
    } else scroller.scrollLeft=0;
    if(time){const startHour=Number(scroller.dataset.startHour||6);scroller.scrollTop=Math.max(0,(minute(time)-startHour*60-60)/60*GRID_HOUR);}
  }
  function render() {
    renderTabs();
    if(ui.view==='calendar')renderCalendar();
    if(ui.view==='reservations')renderReservations();
    if(ui.view==='pending')renderPending();
    if(ui.view==='shopping')renderShopping();
    if(ui.view==='templates')renderTemplates();
  }
  const GRID_HOUR=66;
  function renderCalendar() {
    const start=ui.weekStart,end=addDays(start,6);
    const sd=fromISO(start),ed=fromISO(end);
    $('weekTitle').textContent=sd.getMonth()===ed.getMonth()?`${sd.getDate()}–${ed.getDate()} de ${MONTHS[sd.getMonth()]} ${sd.getFullYear()}`:`${sd.getDate()} ${MONTHS[sd.getMonth()].slice(0,3)} – ${ed.getDate()} ${MONTHS[ed.getMonth()].slice(0,3)} ${ed.getFullYear()}`;
    $('landWeekTitle').textContent=`${sd.getDate()}–${ed.getDate()} ${MONTHS[ed.getMonth()].slice(0,3)}`;
    const today=toISO(new Date());
    const dates=Array.from({length:7},(_,i)=>addDays(start,i));
    const scroller=$('calendarScroller');
    const oldX=scroller.scrollLeft,oldY=scroller.scrollTop,wasRendered=!!scroller.querySelector('.calendar-table');
    const events=dates.map(date=>data.events.filter(e=>eventKind(e)!=='multiday').flatMap(e=>visibleOccurrence(e,date)));
    let startHour=6,endHour=23;
    for(const daily of events)for(const e of daily){startHour=Math.min(startHour,Math.floor(minute(e.start)/60));endHour=Math.max(endHour,Math.ceil((minute(e.start)+(eventKind(e)==='instant'?20:durationMinutes(e)))/60));}
    startHour=Math.max(0,startHour);endHour=Math.min(24,Math.max(endHour,startHour+1));
    const height=(endHour-startHour)*GRID_HOUR;
    scroller.dataset.startHour=String(startHour);
    const timeLabels=Array.from({length:endHour-startHour+1},(_,i)=>`<span class="time-tick" style="top:${i*GRID_HOUR}px">${String(startHour+i).padStart(2,'0')}:00</span>`).join('');
    const head=dates.map((date,i)=>`<button class="head-day ${date===today?'today':''} ${date===ui.selectedDate?'selected':''}" data-date="${date}">${DAYS[i]}<b>${fromISO(date).getDate()}</b></button>`).join('');
    // La barra comparte exactamente las 7 columnas del calendario. El inicio y fin
    // se expresan como fracciones de día (15:00 = 62.5%), incluso al cruzar semanas.
    const spans=data.events.filter(e=>eventKind(e)==='multiday' && e.date<=end && safeEndDate(e)>=start).map(e=>{
      const first=dayDelta(start,e.date)+minute(multiStartTime(e))/1440;
      const last=dayDelta(start,safeEndDate(e))+multiFinishFraction(e);
      return {event:e,left:Math.max(0,first),right:Math.min(7,last)};
    }).filter(x=>x.right>x.left).sort((a,b)=>a.left-b.left || b.right-a.right);
    const lanes=[];let multiBars='';
    for (const span of spans) {
      let lane=lanes.findIndex(right=>right<=span.left+0.001);
      if(lane<0){lane=lanes.length;lanes.push(span.right)}else lanes[lane]=span.right;
      const e=span.event,done=isDone(e.id,e.date);
      const left=span.left/7*100, width=(span.right-span.left)/7*100;
      const display=legacyMulti(e)?e.title:`${e.title} · ${multiStartTime(e)}–${multiEndTime(e)}`;
      const details=`${e.title} · ${e.date} ${multiStartTime(e)} → ${safeEndDate(e)} ${multiEndTime(e)}`;
      multiBars+=`<button class="multiday-event ${done?'done':''}" type="button" data-color="${colorOf(e.color)}" data-event="${esc(e.id)}" data-date="${esc(e.date)}" style="left:${left}%;width:${width}%;top:${lane*29+4}px" title="${esc(details)}" aria-label="${esc(details)}"><span>${esc(display)}</span></button>`;
    }
    const allDay=spans.length?`<div class="multiday-row"><div class="all-day-label">Reservas</div><div class="multiday-track" style="height:${lanes.length*29+8}px">${multiBars}</div></div>`:'';
    const cols=dates.map((date,i)=>{
      const list=events[i].map(e=>({event:e,start:minute(e.start),end:minute(e.start)+(eventKind(e)==='instant'?19:durationMinutes(e))})).sort((a,b)=>a.start-b.start || a.end-b.end);
      // Distribuir tareas simultáneas en columnas para conservar el acceso táctil.
      let groups=[],current=[],groupEnd=-1;
      for(const x of list){if(current.length && x.start>=groupEnd){groups.push(current);current=[];groupEnd=-1}current.push(x);groupEnd=Math.max(groupEnd,x.end)}
      if(current.length)groups.push(current);
      let blocks='';
      for(const group of groups){const ends=[];for(const x of group){let lane=ends.findIndex(end=>end<=x.start);if(lane<0){lane=ends.length;ends.push(x.end)}else ends[lane]=x.end;x.lane=lane}const lanes=ends.length;
        for(const x of group){const e=x.event,instant=eventKind(e)==='instant';
          const top=Math.max(0,(x.start-startHour*60)/60*GRID_HOUR);
          const h=Math.min(height-top,instant?27:Math.max(25,durationMinutes(e)/60*GRID_HOUR-3));
          const done=isDone(e.id,date),left=x.lane/lanes*100,width=100/lanes;
          blocks+=`<button class="event ${instant?'instant':''} ${done?'done':''}" type="button" data-color="${colorOf(e.color)}" data-event="${esc(e.id)}" data-date="${esc(e.occDate||date)}" data-display-date="${date}" style="top:${top}px;height:${h}px;left:calc(${left}% + 4px);right:auto;width:calc(${width}% - 8px)" title="${esc(e.title)} · ${esc(e.start)}"><small>${instant?'◆ ':''}${esc(e.start)}${normalizeRepeat(e.repeat).type!=='none'?'<span class="repeat-mark">↻</span>':''}${done?' ✓':''}</small><strong>${esc(e.title)}</strong><span class="resize-grip" aria-hidden="true"></span></button>`;
        }
      }
      let nowLine='';
      if(date===today){const now=new Date(),pos=(now.getHours()*60+now.getMinutes()-startHour*60)/60*GRID_HOUR;if(pos>=0&&pos<=height)nowLine=`<div class="now-line" style="top:${pos}px"></div>`}
      return `<div class="day-col ${date===today?'today':''} ${date===ui.selectedDate?'selected':''}" data-date="${date}" style="height:${height}px">${blocks}${nowLine}</div>`;
    }).join('');
    scroller.innerHTML=`<div class="calendar-table"><div class="calendar-head"><div class="time-head"></div>${head}</div>${allDay}<div class="calendar-body"><div class="time-ruler" style="height:${height}px">${timeLabels}</div>${cols}</div></div>`;
    scroller.querySelectorAll('.head-day').forEach(x=>x.addEventListener('click',()=>selectDay(x.dataset.date)));
    scroller.querySelectorAll('.day-col').forEach(col=>col.addEventListener('click',ev=>{
      if(ev.target.closest('.event'))return;
      const rect=col.getBoundingClientRect();
      const minutes=Math.max(0,Math.min((endHour-1)*60,Math.floor(((ev.clientY-rect.top)/GRID_HOUR*60+startHour*60)/30)*30));
      ui.selectedDate=col.dataset.date;ui.templateDate=col.dataset.date;
      openSlotChooser(col.dataset.date,timeText(minutes));
    }));
    scroller.querySelectorAll('[data-event]').forEach(btn=>{
      btn.addEventListener('click',ev=>{ev.stopPropagation();if(btn.dataset.suppressClick==='1'){btn.dataset.suppressClick='';return;}openOccurrence(btn.dataset.event,btn.dataset.date)});
      if(btn.classList.contains('event'))enableDragAndResize(btn);
    });
    if(wasRendered){scroller.scrollLeft=oldX;scroller.scrollTop=oldY}
    else {let idx=dates.indexOf(ui.selectedDate);if(idx<0)idx=0;
      const firstCol=scroller.querySelector('.day-col');
      scroller.scrollLeft=scroller.scrollWidth>scroller.clientWidth+4?Math.max(0,idx*(firstCol?.getBoundingClientRect().width||114)):0;
      const reference=ui.weekStart===monday(today)?new Date().getHours():9;
      scroller.scrollTop=Math.max(0,(Math.min(reference,23)-startHour)*GRID_HOUR-42)}
  }
  function enableDragAndResize(el){
    let hold=null,active=false,pointer=null,origin=null,mode='move',ghost=null,moveDate='',moveMinutes=0,moveDuration=0;
    const cancel=()=>{clearTimeout(hold);if(ghost){ghost.remove();ghost=null}active=false;el.classList.remove('dragging')};
    el.addEventListener('pointerdown',e=>{
      if(e.button!==0 || dialog.open)return;
      const event=data.events.find(x=>x.id===el.dataset.event);if(!event||eventKind(event)==='multiday')return;
      mode=e.target.closest('.resize-grip')?'resize':'move';pointer=e.pointerId;
      const fromDate=el.dataset.date,date=el.dataset.displayDate||fromDate;
      const o=data.overrides[event.id+'@'+fromDate];
      origin={event,fromDate,date,start:safeClock(o?.start,event.start||'09:00'),duration:o?.duration??event.duration,x:e.clientX,y:e.clientY};
      moveDate=date;moveMinutes=minute(origin.start);moveDuration=eventKind(event)==='instant'?0:durationMinutes({duration:origin.duration});
      clearTimeout(hold);hold=setTimeout(()=>{
        active=true;el.classList.add('dragging');el.setPointerCapture(pointer);
        ghost=document.createElement('div');ghost.className='drag-preview';document.body.appendChild(ghost);
        updateGhost(e.clientX,e.clientY);
      },mode==='resize'?100:320);
    });
    function updateGhost(x,y){if(!ghost)return;ghost.textContent=(mode==='resize'?'Duración ':'Mover ')+timeText(moveMinutes)+(mode==='resize'?' · '+Math.floor(moveDuration/60)+'h '+moveDuration%60+'min':' · '+moveDate);ghost.style.left=Math.min(innerWidth-200,x+12)+'px';ghost.style.top=Math.max(4,y-42)+'px'}
    el.addEventListener('pointermove',e=>{
      if(e.pointerId!==pointer||!origin)return;
      if(!active){if(Math.abs(e.clientY-origin.y)>9||Math.abs(e.clientX-origin.x)>9){clearTimeout(hold)}return}
      e.preventDefault();const hourStart=Number($('calendarScroller').dataset.startHour||6);
      if(mode==='resize'){
        const delta=Math.round((e.clientY-origin.y)/GRID_HOUR*4)*15;
        moveDuration=Math.max(15,Math.min(1439,durationMinutes({duration:origin.duration})+delta));
      }else{
        const cols=[...document.querySelectorAll('.day-col')];
        const center=cols.find(c=>{const r=c.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right});
        if(center)moveDate=center.dataset.date;
        const current=cols.find(c=>c.dataset.date===moveDate)||cols[0];
        if(current){const rect=current.getBoundingClientRect();moveMinutes=Math.max(0,Math.min(1439,Math.round(((e.clientY-rect.top)/GRID_HOUR*60+hourStart*60)/15)*15));}
      }
      updateGhost(e.clientX,e.clientY);
    });
    el.addEventListener('pointerup',e=>{
      if(e.pointerId!==pointer)return;
      clearTimeout(hold);const changed=active && (moveDate!==origin?.date||moveMinutes!==minute(origin?.start)||moveDuration!==origin?.duration);
      if(active){el.dataset.suppressClick='1';setTimeout(()=>{el.dataset.suppressClick=''},500)}
      const previous=origin;cancel();origin=null;
      if(changed && previous)updateOccurrence(previous.event,previous.fromDate,mode==='resize'?previous.date:moveDate,mode==='resize'?previous.start:timeText(moveMinutes),moveDuration);
    });
    el.addEventListener('pointercancel',()=>{cancel();origin=null});
  }
  function renderReservations(){
    const list=data.events.filter(e=>eventKind(e)==='multiday').sort((a,b)=>a.date.localeCompare(b.date));
    $('reservationsList').innerHTML=list.length?list.map(e=>`<article class="reservation-card"><div><span class="task-color-dot color-${colorOf(e.color)}"></span><b>${esc(e.title)}</b><div class="reservation-meta">${esc(e.date)} ${esc(multiStartTime(e))} → ${esc(safeEndDate(e))} ${esc(multiEndTime(e))}</div><small>${e.reservation?'Check-in, check-out'+(e.includeCleaning===false?'':' y limpieza')+' vinculados':'Evento antiguo de varios días'}</small></div><button class="ghost" data-res-edit="${esc(e.id)}">Editar</button></article>`).join(''):'<div class="empty-state"><b>Sin reservas todavía</b>Crea una y el check-in, el check-out y la limpieza aparecerán automáticamente.</div>';
    $('reservationsList').querySelectorAll('[data-res-edit]').forEach(el=>el.addEventListener('click',()=>{const e=data.events.find(x=>x.id===el.dataset.resEdit);if(e)openReservationForm(e)}));
  }
  function selectDay(date) {
    ui.selectedDate=date;
    ui.templateDate=date;
    if(monday(date)!==ui.weekStart)ui.weekStart=monday(date);
    renderCalendar();
    const idx=dayDelta(ui.weekStart,date),scroller=$('calendarScroller');
    if(scroller.scrollWidth>scroller.clientWidth+4) {
      const col=scroller.querySelector('.day-col');
      scroller.scrollTo({left:Math.max(0,idx*(col?.getBoundingClientRect().width||114)),behavior:'smooth'});
    }
  }
  function renderPending(){
    const arr=[...data.pending].sort((a,b)=>Number(a.done)-Number(b.done));
    $('pendingList').innerHTML=arr.length?arr.map(x=>`<div class="item ${x.done?'done':''}"><input class="check" type="checkbox" data-done-pending="${esc(x.id)}" ${x.done?'checked':''} aria-label="Marcar pendiente como hecho"/><div class="item-main">${esc(x.text)}</div>${!x.done?`<button class="linkish" data-schedule-pending="${esc(x.id)}">Agendar</button>`:''}<button class="delete-icon" data-remove-pending="${esc(x.id)}" title="Eliminar">×</button></div>`).join(''):`<div class="empty-state"><span class="empty-icon">☑</span><b>Todo al día</b>Cuando se te ocurra algo por hacer, añádelo aquí.</div>`;
    $('pendingList').querySelectorAll('[data-done-pending]').forEach(el=>el.addEventListener('change',()=>{const x=data.pending.find(t=>t.id===el.dataset.donePending);if(x){x.done=el.checked;save();render()}}));
    $('pendingList').querySelectorAll('[data-remove-pending]').forEach(el=>el.addEventListener('click',()=>{data.pending=data.pending.filter(t=>t.id!==el.dataset.removePending);save();render()}));
    $('pendingList').querySelectorAll('[data-schedule-pending]').forEach(el=>el.addEventListener('click',()=>{const x=data.pending.find(t=>t.id===el.dataset.schedulePending);if(x)openTaskForm({title:x.text,pendingId:x.id})}));
  }
  function renderShopping(){
    const arr=[...data.shopping].sort((a,b)=>Number(a.done)-Number(b.done));
    $('shoppingList').innerHTML=arr.length?arr.map(x=>`<div class="item ${x.done?'done':''}"><input class="check" type="checkbox" data-done-shopping="${esc(x.id)}" ${x.done?'checked':''} aria-label="Marcar compra como realizada"/><div class="item-main">${esc(x.text)}</div><button class="delete-icon" data-remove-shopping="${esc(x.id)}" title="Eliminar">×</button></div>`).join(''):`<div class="empty-state"><span class="empty-icon">◧</span><b>Lista vacía</b>Añade lo que necesitas comprar.</div>`;
    $('shoppingList').querySelectorAll('[data-done-shopping]').forEach(el=>el.addEventListener('change',()=>{const x=data.shopping.find(t=>t.id===el.dataset.doneShopping);if(x){x.done=el.checked;save();render()}}));
    $('shoppingList').querySelectorAll('[data-remove-shopping]').forEach(el=>el.addEventListener('click',()=>{data.shopping=data.shopping.filter(t=>t.id!==el.dataset.removeShopping);save();render()}));
    $('clearPurchased').hidden=!data.shopping.some(x=>x.done);
  }
  function renderTemplates(){
    const dateInput=$('templateScheduleDate');dateInput.value=ui.templateDate;
    $('templatesList').innerHTML=data.templates.length?data.templates.map(t=>`<article class="template-card"><div class="template-title"><span class="task-color-dot color-${colorOf(t.color)}"></span>${esc(t.title)}</div><div class="template-meta">◷ ${esc(t.start||'09:00')} · ${esc(durationLabel(t))}<br>↻ ${eventKind(t)==='multiday'?'No se repite':esc(repeatLabel(t.repeat))}</div><div class="template-actions"><button class="primary" data-place-template="${esc(t.id)}">+ Agendar</button><button class="icon-secondary" data-edit-template="${esc(t.id)}" aria-label="Editar tarea guardada" title="Editar">✎</button></div></article>`).join(''):`<div class="empty-state"><span class="empty-icon">☆</span><b>Guarda tus tareas habituales</b>Por ejemplo, «Limpieza Capechik» con hora y repetición propias.</div>`;
    $('templatesList').querySelectorAll('[data-place-template]').forEach(el=>el.addEventListener('click',()=>{const t=data.templates.find(x=>x.id===el.dataset.placeTemplate);if(t)addFromTemplate(t)}));
    $('templatesList').querySelectorAll('[data-edit-template]').forEach(el=>el.addEventListener('click',()=>{const t=data.templates.find(x=>x.id===el.dataset.editTemplate);if(t)openTemplateForm(t)}));
  }
  function addFromTemplate(template,options={}){
    const date=options.date||ui.templateDate;
    const kind=eventKind(template);
    const start=options.time||template.start||'09:00';
    const recurring=kind!=='multiday' && normalizeRepeat(template.repeat).type!=='none';
    const already=data.events.some(e=>String(e.title).trim().toLowerCase()===String(template.title).trim().toLowerCase() && e.start===start && occurs(e,date));
    if(already && !confirm('Esta tarea ya aparece ese día y a esa hora. ¿Quieres duplicarla?'))return;
    const ev={id:uid(),title:template.title,date,start,duration:kind==='instant'?0:kind==='timed'?durationMinutes(template):0,
      kind,repeat:kind==='multiday'?normalizeRepeat(null):normalizeRepeat(template.repeat),color:colorOf(template.color)};
    if(kind==='multiday'){ev.endDate=addDays(date,daySpan(template)-1);ev.endTime=safeClock(template.endTime,'11:00');}
    data.events.push(ev);save();ui.selectedDate=date;ui.templateDate=date;ui.weekStart=monday(date);ui.view='calendar';render();
    focusCalendarDay(date,kind==='multiday'?null:start);toast(recurring?'Tarea repetitiva agendada':'Tarea agendada');
  }
  function openSlotChooser(date,time){
    const choices=data.templates.map(t=>`<button type="button" class="slot-template" data-choose-template="${esc(t.id)}"><span class="task-color-dot color-${colorOf(t.color)}"></span><span class="slot-template-copy"><b>${esc(t.title)}</b><small>${esc(durationLabel(t))} · ${eventKind(t)==='multiday'?'varios días':esc(t.start||'09:00')}</small></span><span class="slot-plus">+</span></button>`).join('');
    showDialog(`<div class="modal">${modalHeader('Agregar a esta hora')}<div class="modal-body">
      <div class="slot-summary">${esc(dayLong(date))} ${time?'· <b>'+esc(time)+'</b>':'· usa la hora guardada'}</div>
      ${choices?`<p class="slot-section-label">Elige una tarea y quedará agendada:</p><input class="template-search" id="templateSearch" placeholder="Buscar limpieza, check-in..." aria-label="Buscar tareas guardadas"><div class="slot-template-list">${choices}</div>`:'<p class="slot-empty">No tienes tareas guardadas todavía. Puedes crear una nueva ahora.</p>'}
      <button type="button" class="slot-create" id="newTaskHere"><span>＋</span> Crear nueva tarea aquí</button>
    </div></div>`);
    content.querySelector('#templateSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();content.querySelectorAll('[data-choose-template]').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(q))});
    content.querySelectorAll('[data-choose-template]').forEach(btn=>btn.addEventListener('click',()=>{
      const t=data.templates.find(x=>x.id===btn.dataset.chooseTemplate);
      if(!t)return;
      closeDialog();addFromTemplate(t,{date,...(time?{time}:{})});
    }));
    content.querySelector('#newTaskHere').addEventListener('click',()=>{closeDialog();openTaskForm({date,time:time||'09:00'})});
  }
  function openQuickAdd(){
    showDialog(`<div class="modal">${modalHeader('¿Qué quieres agregar?')}<div class="modal-body"><button class="action-option" data-kind="reservation"><span class="option-glyph">⌂</span><span>Reserva<small>Crea check-in, check-out y limpieza</small></span></button><button class="action-option" data-kind="saved"><span class="option-glyph">☆</span><span>Agendar tarea guardada<small>Elige una con un toque</small></span></button><button class="action-option" data-kind="task"><span class="option-glyph">▦</span><span>Tarea en el calendario<small>Con fecha y hora, o repetida</small></span></button><button class="action-option" data-kind="pending"><span class="option-glyph">☑</span><span>Pendiente sin fecha<small>Para hacer cuando puedas</small></span></button><button class="action-option" data-kind="shopping"><span class="option-glyph">◧</span><span>Algo que comprar<small>Se añade a tu lista de compras</small></span></button><button class="action-option" data-kind="copyday"><span class="option-glyph">⧉</span><span>Copiar día o semana<small>Repetir programación sin escribirla</small></span></button><button class="action-option" data-kind="template"><span class="option-glyph">☆</span><span>Tarea guardada<small>Hora y repetición predeterminadas</small></span></button></div></div>`);
    content.querySelectorAll('[data-kind]').forEach(btn=>btn.addEventListener('click',()=>{const kind=btn.dataset.kind;closeDialog();if(kind==='copyday')openCopySchedule();if(kind==='reservation')openReservationForm();if(kind==='saved')openSlotChooser(ui.selectedDate,null);if(kind==='task')openTaskForm();if(kind==='template')openTemplateForm();if(kind==='pending')openSmallEntry('pending');if(kind==='shopping')openSmallEntry('shopping')}));
  }
  function openSmallEntry(kind){
    const label=kind==='pending'?'Pendiente sin fecha':'Agregar compra';
    showDialog(`<div class="modal">${modalHeader(label)}<form id="smallForm" class="modal-body"><label class="field">${kind==='pending'?'¿Qué tienes que hacer?':'¿Qué necesitas comprar?'}<input name="text" maxlength="150" required autofocus placeholder="Escríbelo aquí" /></label><div class="modal-actions"><button class="ghost" type="button" data-close2>Cancelar</button><button class="primary" type="submit">Agregar</button></div></form></div>`);
    content.querySelector('[data-close2]').addEventListener('click',closeDialog);
    content.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const text=e.target.elements.text.value.trim();if(!text)return;data[kind].push({id:uid(),text,done:false});save();closeDialog();setView(kind);toast('Agregado')});
    content.querySelector('input').focus();
  }
  function openReservationForm(existing=null){
    const isEdit=!!existing;
    const today=ui.selectedDate;
    const oldP=existing?.property||'biu';
    const startDate=existing?.date||today,endDate=existing?.endDate||addDays(startDate,2);
    showDialog(`<div class="modal editor-compact">${modalHeader(isEdit?'Editar reserva':'Nueva reserva')}<form id="reservationForm" class="modal-body compact-fields" novalidate>
      <label class="field">Alojamiento<select name="property">${Object.entries(PROPERTY_MAP).map(([key,p])=>`<option value="${key}" ${oldP===key?'selected':''}>${p.name}</option>`).join('')}</select></label>
      <label class="field">Nombre / referencia (opcional)<input name="label" placeholder="Ej. Reserva de Ana" value="${esc(existing?.label||'')}"></label>
      <label class="field">Entrada (fecha)<input name="date" type="date" required value="${esc(startDate)}"></label>
      <label class="field">Check-in<input name="start" type="time" required value="${esc(existing?multiStartTime(existing):'15:00')}"></label>
      <label class="field">Salida (fecha)<input name="endDate" type="date" required value="${esc(endDate)}"></label>
      <label class="field">Check-out<input name="endTime" type="time" required value="${esc(existing?multiEndTime(existing):'10:00')}"></label>
      <label class="checkbox-row full"><input type="checkbox" name="includeCleaning" ${existing?.includeCleaning===false?'':'checked'}> Programar limpieza automáticamente</label>
      <div class="form-row full" id="cleaningOptions"><label class="field">Hora limpieza<input name="cleaningTime" type="time" value="${esc(existing?.cleaningTime||'11:00')}"></label><label class="field">Duración (min)<input name="cleaningDuration" type="number" min="1" max="1439" value="${esc(existing?.cleaningDuration??60)}"></label></div>
      <p class="hint full">Se crea una barra superior y solo dos avisos puntuales en el horario: check-in y check-out. La limpieza queda vinculada y editable.</p>
      <div class="modal-actions full"><button class="ghost" type="button" data-cancel>Cancelar</button><button class="primary" type="submit">${isEdit?'Guardar reserva':'Agregar reserva'}</button></div>
      ${isEdit?'<button type="button" class="danger full" data-delete-res>Eliminar reserva y tareas vinculadas</button>':''}
    </form></div>`);
    const f=content.querySelector('#reservationForm');
    const refresh=()=>{f.querySelector('#cleaningOptions').hidden=!f.elements.includeCleaning.checked};
    f.elements.includeCleaning.addEventListener('change',refresh);refresh();
    content.querySelector('[data-cancel]').addEventListener('click',closeDialog);
    f.addEventListener('submit',e=>{
      e.preventDefault();const p=PROPERTY_MAP[f.elements.property.value],date=f.elements.date.value,last=f.elements.endDate.value,st=f.elements.start.value,et=f.elements.endTime.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{4}-\d{2}-\d{2}$/.test(last)||last<date){toast('Revisa las fechas de la reserva');return}
      if(dayDelta(date,last)>729){toast('Máximo 730 días');return}
      if(last===date&&minute(et)<=minute(st)){toast('La salida debe ser posterior a la entrada');return}
      const label=f.elements.label.value.trim();const duration=Number(f.elements.cleaningDuration.value);
      if(f.elements.includeCleaning.checked&&(!Number.isInteger(duration)||duration<1||duration>1439)){toast('Duración de limpieza no válida');return}
      rememberUndo();
      const next={...(existing||{}),id:existing?.id||uid(),kind:'multiday',reservation:true,title:label||'Reserva '+p.name,label,property:f.elements.property.value,date,endDate:last,start:st,endTime:et,color:p.color,duration:0,repeat:noRepeat(),includeCleaning:f.elements.includeCleaning.checked,cleaningTime:f.elements.cleaningTime.value,cleaningDuration:duration};
      if(existing)Object.assign(existing,next);else data.events.push(next);
      syncReservationChildren(existing||next);save();closeDialog();ui.selectedDate=date;ui.templateDate=date;ui.weekStart=monday(date);setView('calendar');toastUndo(isEdit?'Reserva actualizada':'Reserva y tareas agregadas');
    });
    content.querySelector('[data-delete-res]')?.addEventListener('click',()=>{if(!confirm('¿Eliminar reserva, check-in, check-out y limpieza vinculados?'))return;rememberUndo();removeReservation(existing);closeDialog();render();toastUndo('Reserva eliminada')});
  }
  function openCopySchedule(){
    showDialog(`<div class="modal editor-compact">${modalHeader('Copiar programación')}<form class="modal-body compact-fields" id="copyScheduleForm"><label class="field">Copiar<select name="mode"><option value="day">Un día</option><option value="week">Una semana</option></select></label><label class="field">Desde<input type="date" name="from" value="${ui.selectedDate}" required></label><label class="field">Hacia<input type="date" name="to" value="${addDays(ui.selectedDate,7)}" required></label><p class="hint full">Solo copia tareas puntuales; no duplica reservas ni series repetitivas.</p><div class="modal-actions full"><button class="ghost" type="button" data-cancel>Cancelar</button><button type="submit" class="primary">Copiar</button></div></form></div>`);
    const form=content.querySelector('#copyScheduleForm');content.querySelector('[data-cancel]').addEventListener('click',closeDialog);
    form.addEventListener('submit',e=>{e.preventDefault();const from=form.elements.from.value,to=form.elements.to.value,number=form.elements.mode.value==='week'?7:1;
      if(!from||!to)return;let added=0;rememberUndo();const newItems=[];
      for(let n=0;n<number;n++){const oldDate=addDays(from,n),newDate=addDays(to,n);
        for(const ev of data.events.filter(x=>eventKind(x)!=='multiday'&&!x.linkedReservationId&&normalizeRepeat(x.repeat).type==='none'&&x.date===oldDate)){
          newItems.push({...ev,id:uid(),date:newDate});added++;
        }
      }data.events.push(...newItems);save();closeDialog();ui.selectedDate=to;ui.weekStart=monday(to);setView('calendar');toastUndo(added+' tareas copiadas');
    });
  }
  function openTaskForm(args={}){
    const event=args.event||null,t=args.template||null;
    const title=event?.title||t?.title||args.title||'';
    const date=event?.date||args.date||ui.selectedDate;
    const start=event?.start||args.time||t?.start||'09:00';
    const duration=Number(event?.duration??t?.duration??60);
    const kind=eventKind(event||t);
    const endDate=event?.endDate||addDays(date,2);
    const repeat=normalizeRepeat(event?.repeat||t?.repeat);
    const editing=!!event;
    showDialog(`<div class="modal editor-compact">${modalHeader(editing?'Editar tarea':'Nueva tarea')}<form id="taskForm" class="modal-body" novalidate>
      <label class="field">Tarea<input type="text" name="title" maxlength="150" placeholder="Ej. Limpieza Capechik o Reserva Moroli" value="${esc(title)}" required autofocus /></label>
      <label class="field">Primer día<input type="date" name="date" value="${esc(date)}" required /></label>
      <div data-time-field><label class="field">Hora<input type="time" name="start" value="${esc(start)}" required /></label></div>
      ${kindControls(kind,duration,false,endDate,2,event && eventKind(event)==='multiday'?multiStartTime(event):'15:00',event && eventKind(event)==='multiday'?multiEndTime(event):'11:00')}
      ${!editing ? '' : '<p class="hint compact-hint">Toca el nombre, hora o duración para cambiarlo.</p>'}
      ${colorControls(event?.color||t?.color)}
      <div data-recurrence-wrap>${repeatControls(repeat,date)}</div>
      ${!editing?`<label class="checkbox-row"><input type="checkbox" name="alsoTemplate" /> Guardar también como tarea habitual</label>`:repeat.type!=='none'?'<p class="hint">Editar esta tarea cambia toda su serie de repeticiones.</p>':''}
      <div class="modal-actions"><button class="ghost" type="button" data-cancel>Cancelar</button><button class="primary" type="submit">${editing?'Guardar cambios':'Agregar al calendario'}</button></div>
    </form></div>`);
    const form=content.querySelector('#taskForm');
    wireRepeat(form,form.elements.date);wireKind(form);
    content.querySelector('[data-cancel]').addEventListener('click',closeDialog);
    form.addEventListener('submit',ev=>{
      ev.preventDefault();
      const title=form.elements.title.value.trim(),date=form.elements.date.value,start=form.elements.start.value;
      if(!title){toast('Escribe un nombre para la tarea');form.elements.title.focus();return}
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast('Elige una fecha');form.elements.date.focus();return}
      if(!/^\d{2}:\d{2}$/.test(start)){toast('Elige una hora');form.elements.start.focus();return}
      const timing=readKind(form);if(!timing)return;
      const rep=timing.kind==='multiday'?normalizeRepeat(null):collectRepeat(form);if(!rep)return;
      const next={id:event?.id||uid(),title,date,start,repeat:rep,color:colorOf(form.elements.color.value),...timing};
      if(event?.linkedReservationId){next.linkedReservationId=event.linkedReservationId;next.linkedRole=event.linkedRole;next.linkedCustomized=true}
      if(editing){const idx=data.events.findIndex(x=>x.id===event.id);if(idx<0)return;data.events[idx]=next}
      else data.events.push(next);
      if(!editing && form.elements.alsoTemplate?.checked){
        const exists=data.templates.find(x=>x.title.toLowerCase()===title.toLowerCase());
        const template={id:exists?.id||uid(),title,start,repeat:rep,color:next.color,kind:next.kind,duration:next.duration};
        if(next.kind==='multiday'){template.spanDays=dayDelta(date,next.endDate)+1;template.endTime=next.endTime;}
        if(exists)Object.assign(exists,template);else data.templates.push(template);
      }
      if(args.pendingId)data.pending=data.pending.filter(x=>x.id!==args.pendingId);
      save();closeDialog();ui.selectedDate=date;ui.templateDate=date;ui.weekStart=monday(date);setView('calendar');
      focusCalendarDay(date,timing.kind==='multiday'?null:start);toast(editing?'Tarea actualizada':'Tarea añadida');
    });
    form.elements.title.focus();
  }
  function openTemplateForm(template=null){
    const editing=!!template;
    const rep=normalizeRepeat(template?.repeat);
    const kind=eventKind(template);
    showDialog(`<div class="modal">${modalHeader(editing?'Editar tarea guardada':'Guardar tarea habitual')}<form id="templateForm" class="modal-body" novalidate>
      <label class="field">Nombre de la tarea<input name="title" maxlength="150" placeholder="Ej. Limpieza Capechik" value="${esc(template?.title||'')}" required autofocus /></label>
      <div data-time-field><label class="field">Hora habitual<input type="time" name="start" value="${esc(template?.start||'09:00')}" required /></label></div>
      ${kindControls(kind,Number(template?.duration??60),true,'',template?.spanDays,template && kind==='multiday'?multiStartTime(template):'15:00',template && kind==='multiday'?multiEndTime(template):'11:00')}
      ${colorControls(template?.color)}
      <div data-recurrence-wrap>${repeatControls(rep,ui.templateDate)}</div>
      <p class="hint">Guárdala aquí y podrás agregarla al calendario tocando un día y una hora.</p>
      <div class="modal-actions"><button class="ghost" type="button" data-cancel>Cancelar</button><button class="primary" type="submit">Guardar</button></div>
      ${editing?'<div class="divider-line"></div><button type="button" class="danger" data-delete-template>Eliminar tarea guardada</button>':''}
    </form></div>`);
    const form=content.querySelector('#templateForm');wireRepeat(form);wireKind(form,true);
    content.querySelector('[data-cancel]').addEventListener('click',closeDialog);
    form.addEventListener('submit',ev=>{
      ev.preventDefault();const title=form.elements.title.value.trim(),start=form.elements.start.value;
      if(!title){toast('Escribe el nombre de la tarea guardada');form.elements.title.focus();return}
      if(!start){toast('Elige una hora');return}
      const timing=readKind(form,true);if(!timing)return;
      const repeat=timing.kind==='multiday'?normalizeRepeat(null):collectRepeat(form);if(!repeat)return;
      const next={id:template?.id||uid(),title,start,repeat,color:colorOf(form.elements.color.value),...timing};
      if(editing){const idx=data.templates.findIndex(x=>x.id===template.id);if(idx>=0)data.templates[idx]=next}
      else data.templates.push(next);
      save();closeDialog();setView('templates');toast('Tarea habitual guardada');
    });
    content.querySelector('[data-delete-template]')?.addEventListener('click',()=>{if(!confirm('¿Eliminar esta tarea guardada? Las tareas que ya agendaste se conservarán.'))return;data.templates=data.templates.filter(x=>x.id!==template.id);save();closeDialog();render()});
    form.elements.title.focus();
  }
  function openOccurrence(id,day){
    const event=data.events.find(x=>x.id===id);if(!event)return;
    const done=isDone(id,day),recurring=eventKind(event)!=='multiday' && normalizeRepeat(event.repeat).type!=='none';
    showDialog(`<div class="modal">${modalHeader('Tu tarea')}<div class="modal-body">
      <div class="occ-summary"><b><span class="task-color-dot color-${colorOf(event.color)}"></span>${esc(event.title)}</b><span>${esc(dayLong(day))} · ${eventKind(event)==='multiday'?esc(dayLong(event.date)+' '+multiStartTime(event)+' → '+dayLong(safeEndDate(event))+' '+multiEndTime(event)):esc(safeClock(data.overrides[id+'@'+day]?.start,event.start))+' · '+esc(durationLabel(event))} ${recurring?'· ↻ '+esc(repeatLabel(event.repeat)):''}</span></div>
      <div class="stack"><button class="primary" data-complete>${done?'↩ Marcar como pendiente':'✓ Marcar como hecha'}</button><button class="ghost" data-edit>Editar ${recurring?'toda la serie':'tarea'}</button><button class="ghost" data-duplicate>Duplicar tarea</button>${recurring?'<button class="ghost" data-one-day>Modificar hora solo este día</button>':''}${recurring?'<button class="ghost" data-skip>Omitir solo este día</button>':''}<button class="danger" data-delete>${recurring?'Eliminar toda la serie':'Eliminar tarea'}</button></div>
    </div></div>`);
    content.querySelector('[data-complete]').addEventListener('click',()=>{const k=id+'@'+day;if(done)delete data.completed[k];else data.completed[k]=true;save();closeDialog();renderCalendar();toast(done?'Tarea pendiente':'Tarea completada')});
    content.querySelector('[data-edit]').addEventListener('click',()=>{closeDialog();eventKind(event)==='multiday'?openReservationForm(event):openTaskForm({event})});
    content.querySelector('[data-duplicate]').addEventListener('click',()=>{rememberUndo();const original=data.overrides[id+'@'+day]||{};const copy={...event,id:uid(),date:original.date||day,start:original.start||event.start,duration:original.duration??event.duration,repeat:noRepeat()};delete copy.linkedReservationId;delete copy.linkedRole;delete copy.linkedCustomized;delete copy.reservation;data.events.push(copy);save();closeDialog();renderCalendar();toastUndo('Tarea duplicada')});
    content.querySelector('[data-one-day]')?.addEventListener('click',()=>{
      const original=data.overrides[id+'@'+day]?.start||event.start||'09:00';
      showDialog(`<div class="modal">${modalHeader('Solo este día')}<form class="modal-body" id="overrideForm"><p class="slot-summary">${esc(event.title)} · ${esc(dayLong(day))}</p><label class="field">Fecha<input name="date" type="date" value="${esc(data.overrides[id+'@'+day]?.date||day)}" required /></label><label class="field">Hora<input name="start" type="time" value="${esc(original)}" required /></label><label class="field">Duración (minutos)<input name="duration" type="number" min="1" max="1439" value="${Number(data.overrides[id+'@'+day]?.duration??event.duration??60)}" /></label><div class="modal-actions"><button type="button" class="ghost" data-reset-override>Restaurar hora habitual</button><button type="submit" class="primary">Guardar</button></div></form></div>`);
      content.querySelector('#overrideForm').addEventListener('submit',ev=>{ev.preventDefault();data.overrides[id+'@'+day]={date:ev.target.elements.date.value,start:ev.target.elements.start.value,duration:Number(ev.target.elements.duration.value)};if(event.linkedReservationId)event.linkedCustomized=true;save();closeDialog();renderCalendar();toast('Solo esta ocurrencia actualizada')});
      content.querySelector('[data-reset-override]').addEventListener('click',()=>{delete data.overrides[id+'@'+day];save();closeDialog();renderCalendar();toast('Hora habitual restaurada')});
    });
    content.querySelector('[data-skip]')?.addEventListener('click',()=>{data.skipped[id+'@'+day]=true;delete data.completed[id+'@'+day];save();closeDialog();renderCalendar();toast('Se omitió solo este día')});
    content.querySelector('[data-delete]').addEventListener('click',()=>{if(!confirm(recurring?'¿Borrar todas las repeticiones de esta tarea?':'¿Eliminar esta tarea?'))return;rememberUndo();if(eventKind(event)==='multiday'&&event.reservation){removeReservation(event);closeDialog();render();toastUndo('Reserva eliminada');return;}data.events=data.events.filter(e=>e.id!==id);for(const k of Object.keys(data.completed))if(k.startsWith(id+'@'))delete data.completed[k];for(const k of Object.keys(data.skipped))if(k.startsWith(id+'@'))delete data.skipped[k];for(const k of Object.keys(data.overrides))if(k.startsWith(id+'@'))delete data.overrides[k];save();closeDialog();renderCalendar();toastUndo('Tarea eliminada')});
  }
  function openSettings(){
    showDialog(`<div class="modal">${modalHeader('Respaldo y ajustes')}<div class="modal-body"><p style="font-size:13px;color:#6c7890;margin-bottom:18px">Tus tareas se guardan en este dispositivo, dentro del navegador. Para no perderlas al cambiar de teléfono o borrar los datos, descarga un respaldo.</p><div class="stack"><button class="primary" id="exportBtn">↓ Descargar respaldo (.json)</button><button class="ghost" id="importBtn">↑ Restaurar un respaldo</button></div><div class="divider-line"></div><p class="warning">Esta versión funciona sin cuenta y sin conexión después de instalarla. Todavía no envía notificaciones cuando la aplicación está cerrada.</p></div></div>`);
    content.querySelector('#exportBtn').addEventListener('click',()=>{
      const blob=new Blob([JSON.stringify({format:'mi-semana-v1',exportedAt:new Date().toISOString(),...data},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mi-semana-respaldo-'+toISO(new Date())+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Respaldo descargado');
    });
    content.querySelector('#importBtn').addEventListener('click',()=>$('backupImport').click());
  }
  $('backupImport').addEventListener('change',async ev=>{
    const file=ev.target.files[0];if(!file)return;
    try{if(file.size>5e6)throw new Error('Archivo demasiado grande');const obj=JSON.parse(await file.text());if(!Array.isArray(obj.events)||!Array.isArray(obj.pending)||!Array.isArray(obj.shopping)||!Array.isArray(obj.templates))throw new Error('No es un respaldo compatible');
      if(!confirm('Restaurar reemplazará las tareas actuales con las del archivo. ¿Continuar?'))return;
      const next={events:obj.events,pending:obj.pending,shopping:obj.shopping,templates:obj.templates,completed:obj.completed||{},skipped:obj.skipped||{},overrides:obj.overrides||{},defaultsSeededV13:obj.defaultsSeededV13||false};
      localStorage.setItem(KEY,JSON.stringify(next));data=load();if(addDefaultTemplates(data))save();closeDialog();setView('calendar');toast('Respaldo restaurado');
    }catch(e){alert('No se pudo importar: '+e.message)}finally{ev.target.value=''}
  });
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  $('prevWeek').addEventListener('click',()=>{ui.weekStart=addDays(ui.weekStart,-7);ui.selectedDate=ui.weekStart;ui.templateDate=ui.selectedDate;renderCalendar()});
  $('nextWeek').addEventListener('click',()=>{ui.weekStart=addDays(ui.weekStart,7);ui.selectedDate=ui.weekStart;ui.templateDate=ui.selectedDate;renderCalendar()});
  $('todayBtn').addEventListener('click',()=>{ui.selectedDate=toISO(new Date());ui.templateDate=ui.selectedDate;ui.weekStart=monday(ui.selectedDate);$('calendarScroller').innerHTML='';renderCalendar()});
  $('quickAddTop').addEventListener('click',openQuickAdd);
  $('landPrevWeek').addEventListener('click',()=>$('prevWeek').click());
  $('landNextWeek').addEventListener('click',()=>$('nextWeek').click());
  $('landToday').addEventListener('click',()=>$('todayBtn').click());
  $('landSections').addEventListener('click',()=>{
    showDialog(`<div class="modal">${modalHeader('Secciones')}<div class="modal-body">${[['calendar','Calendario'],['reservations','Reservas'],['pending','Pendientes'],['shopping','Compras'],['templates','Tareas guardadas']].map(([key,label])=>`<button class="action-option" type="button" data-go-view="${key}">${label}</button>`).join('')}</div></div>`);
    content.querySelectorAll('[data-go-view]').forEach(b=>b.addEventListener('click',()=>{closeDialog();setView(b.dataset.goView)}));
  });
  $('floatingAdd').addEventListener('click',openQuickAdd);
  $('newTemplate').addEventListener('click',()=>openTemplateForm());
  $('newReservation').addEventListener('click',()=>openReservationForm());
  $('settingsButton').addEventListener('click',openSettings);
  $('templateScheduleDate').addEventListener('change',e=>{if(e.target.value)ui.templateDate=e.target.value});
  $('pendingForm').addEventListener('submit',e=>{e.preventDefault();const text=$('pendingInput').value.trim();if(!text){toast('Escribe el pendiente primero');$('pendingInput').focus();return;}data.pending.push({id:uid(),text,done:false});$('pendingInput').value='';save();renderPending();renderTabs()});
  $('shoppingForm').addEventListener('submit',e=>{e.preventDefault();const text=$('shoppingInput').value.trim();if(!text){toast('Escribe lo que necesitas comprar');$('shoppingInput').focus();return;}data.shopping.push({id:uid(),text,done:false});$('shoppingInput').value='';save();renderShopping()});
  $('clearPurchased').addEventListener('click',()=>{data.shopping=data.shopping.filter(x=>!x.done);save();renderShopping()});
  render();
  if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
