const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8',...headers}});
const cors = {'cache-control':'no-store'};
const enc = new TextEncoder();
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
async function sign(value, secret) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(await crypto.subtle.sign('HMAC',key,enc.encode(value))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function isAdmin(request, env) {
  const cookie=request.headers.get('Cookie')||'';
  const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('sj_session='))?.slice(11);
  if(!token||!env.SESSION_SECRET)return false;
  const [exp,sig]=token.split('.');
  if(!exp||!sig||Number(exp)<Date.now())return false;
  return (await sign(exp,env.SESSION_SECRET))===sig;
}
const cookie=(value,maxAge)=>`sj_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
async function handle(request,env){
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/login'&&request.method==='POST'){
    const {password}=await request.json();
    if(!env.ADMIN_PASSWORD||password!==env.ADMIN_PASSWORD)return json({error:'Неверный пароль'},401,cors);
    const exp=String(Date.now()+7*24*60*60*1000),sig=await sign(exp,env.SESSION_SECRET);
    return json({ok:true},200,{...cors,'set-cookie':cookie(`${exp}.${sig}`,604800)});
  }
  if(path==='/api/logout'&&request.method==='POST')return json({ok:true},200,{...cors,'set-cookie':cookie('',0)});
  const admin=await isAdmin(request,env);
  if(path==='/api/session')return json({admin},200,cors);
  if(path==='/api/lessons'&&request.method==='GET'){
    const {results}=await env.DB.prepare('SELECT * FROM lessons ORDER BY week, weekday, time').all();return json(results,200,cors);
  }
  if(path==='/api/tasks'&&request.method==='GET'){
    const {results}=await env.DB.prepare('SELECT * FROM tasks ORDER BY due_date, id DESC').all();
    const files=await env.DB.prepare('SELECT id,task_id,file_name,mime_type FROM attachments ORDER BY id').all();
    return json({tasks:results,attachments:files.results},200,cors);
  }
  if(path==='/api/files'&&request.method==='GET'){
    const id=Number(url.searchParams.get('id'));const file=await env.DB.prepare('SELECT file_name,mime_type,object_key FROM attachments WHERE id=?').bind(id).first();
    if(!file)return json({error:'Файл не найден'},404,cors);
    const object=await env.FILES.get(file.object_key);
    if(!object)return json({error:'Файл не найден в хранилище'},404,cors);
    return new Response(object.body,{headers:{'content-type':file.mime_type||'application/octet-stream','content-disposition':`inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,'cache-control':'private, max-age=60'}});
  }
  if(!admin)return json({error:'Требуется вход старосты'},401,cors);
  if(path==='/api/lessons'&&request.method==='POST'){
    const x=await request.json();if(!x.subject||!x.weekday||!x.week||!x.time)return json({error:'Заполните предмет, день, неделю и время'},400,cors);
    const r=await env.DB.prepare('INSERT INTO lessons(subject,week,weekday,time,room) VALUES(?,?,?,?,?)').bind(x.subject,x.week,x.weekday,x.time,x.room||'').run();
    return json({id:r.meta.last_row_id},201,cors);
  }
  if(path==='/api/tasks'&&request.method==='POST'){
    const x=await request.json();if(!x.title||!x.lesson_id)return json({error:'Выберите пару и название задания'},400,cors);
    const r=await env.DB.prepare('INSERT INTO tasks(lesson_id,title,description,due_date) VALUES(?,?,?,?)').bind(x.lesson_id,x.title,x.description||'',x.due_date||'').run();
    return json({id:r.meta.last_row_id},201,cors);
  }
  const taskMatch=path.match(/^\/api\/tasks\/(\d+)$/);
  if(taskMatch&&request.method==='PUT'){
    const x=await request.json();await env.DB.prepare('UPDATE tasks SET lesson_id=?,title=?,description=?,due_date=? WHERE id=?').bind(x.lesson_id,x.title,x.description||'',x.due_date||'',Number(taskMatch[1])).run();return json({ok:true},200,cors);
  }
  if(taskMatch&&request.method==='DELETE'){
    const id=Number(taskMatch[1]);const {results}=await env.DB.prepare('SELECT object_key FROM attachments WHERE task_id=?').bind(id).all();for(const f of results)await env.FILES.delete(f.object_key);await env.DB.batch([env.DB.prepare('DELETE FROM attachments WHERE task_id=?').bind(id),env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(id)]);return json({ok:true},200,cors);
  }
  if(path==='/api/attachments'&&request.method==='POST'){
    const form=await request.formData(),taskId=Number(form.get('task_id')),file=form.get('file');
    if(!taskId||!file||typeof file.arrayBuffer!=='function')return json({error:'Некорректный файл'},400,cors);
    if(file.size>30*1024*1024)return json({error:'Файл слишком большой. Максимум 30 МБ.'},413,cors);
    const task=await env.DB.prepare('SELECT id FROM tasks WHERE id=?').bind(taskId).first();if(!task)return json({error:'Задание не найдено'},404,cors);
    const key=`attachments/${taskId}/${crypto.randomUUID()}`;
    await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'}});
    try{const r=await env.DB.prepare('INSERT INTO attachments(task_id,file_name,mime_type,object_key) VALUES(?,?,?,?)').bind(taskId,file.name||'file',file.type||'application/octet-stream',key).run();return json({id:r.meta.last_row_id},201,cors)}catch(e){await env.FILES.delete(key);throw e}
  }
  if(path==='/api/attachments'&&request.method==='DELETE'){
    const id=Number(url.searchParams.get('id'));const file=await env.DB.prepare('SELECT object_key FROM attachments WHERE id=?').bind(id).first();if(file)await env.FILES.delete(file.object_key);await env.DB.prepare('DELETE FROM attachments WHERE id=?').bind(id).run();return json({ok:true},200,cors);
  }
  return json({error:'Not found'},404,cors);
}
export default {async fetch(request,env){try{if(new URL(request.url).pathname.startsWith('/api/'))return await handle(request,env);return env.ASSETS.fetch(request)}catch(e){return json({error:e.message||'Ошибка сервера'},500)}}};
