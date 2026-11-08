(function(){
var D=window.PRD,U=D.ui,NS='http://www.w3.org/2000/svg';
function el(t,a,p){var e=document.createElementNS(NS,t);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var F={};D.findings.forEach(function(f){F[f.id]=f});
var VIEW={},cur=null;

function draw(dg){
 var svg=document.getElementById('seq-'+dg.id),det=document.getElementById('detail-'+dg.id);
 var LL=dg.lifelines,M=dg.messages,X={},names={},GAP=108,X0=95;
 LL.forEach(function(l,i){X[l.id]=X0+i*GAP;names[l.id]=l.name});
 var W=Math.max(1120,X0+(LL.length-1)*GAP+52+112);
 svg.style.minWidth=Math.round(W*0.86)+'px';
 var ACT={};(dg.activations||[]).forEach(function(a){ACT[a.lifeline]=1});
 var rowF={},lfF={};
 function add(map,k,v){map[k]=map[k]||[];if(map[k].indexOf(v)<0)map[k].push(v)}
 D.findings.forEach(function(f){(f.anchors||[]).forEach(function(a){if(a.diagram!==dg.id)return;
  (a.steps||[]).forEach(function(r){add(rowF,r,f.id)});
  (a.lifelines||[]).forEach(function(l){add(lfF,l,f.id)})})});
 var y=112,n=0,byN={};
 M.forEach(function(m){if(m.section){m._y=y;y+=28;return}n++;m._n=n;m._y=y+10;byN[n]=m;y+=32});
 var H=y+16;svg.setAttribute('viewBox','0 0 '+W+' '+H);
 var defs=el('defs',{},svg),mid='arw-'+dg.id,mk=el('marker',{id:mid,'class':'arw',viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse'},defs);el('path',{d:'M0 0L10 5L0 10z'},mk);
 var gHit=el('g',{},svg),gBg=el('g',{},svg),gLL=el('g',{},svg),gTop=el('g',{},svg),gRows=el('g',{},svg);
 M.forEach(function(m,i){if(!m.section)return;
  var g=el('g',{},gBg);
  if(m.box){var end=H-8;for(var j=i+1;j<M.length;j++){if(M[j].section){end=M[j]._y-6;break}}
   var bx=X[m.box]-62;
   el('rect',{x:bx,y:m._y-2,width:W-90-bx,height:end-m._y+2,rx:10,'class':'txbox'},g);
   var tl=el('text',{x:bx+10,y:m._y+12,'class':'txl'},gTop);tl.textContent=m.section;
  }else{var t=el('text',{x:12,y:m._y+12,'class':'secl'},gTop);t.textContent=m.section;el('line',{x1:12,x2:W-12,y1:m._y+18,y2:m._y+18,'class':'secline'},g)}
 });
 LL.forEach(function(l){
  var g=el('g',{'class':'fx ll','data-id':l.id,'data-f':(lfF[l.id]||[]).join(' ')},gLL),x=X[l.id];
  el('line',{x1:x,x2:x,y1:76,y2:H-8,'class':'lifeline'},g);
  el('rect',{x:x-52,y:8,width:104,height:66,rx:8,'class':'hd st-'+l.st},g);
  var lines=l.lines,top=8+(66-(lines.length*12.5+12))/2+10;
  lines.forEach(function(s,i){var t=el('text',{x:x,y:top+i*12.5,'text-anchor':'middle','class':'hdt'},g);t.textContent=s});
  var st=el('text',{x:x,y:top+lines.length*12.5+1,'text-anchor':'middle','class':'hds'},g);st.textContent=l.sub||'';
  (lfF[l.id]||[]).forEach(function(k,i,a){var bx=x-((a.length*30)-4)/2+i*30;var b=el('g',{'class':'bd'},g);el('rect',{x:bx,y:80,width:26,height:15,rx:4,'class':'sev-'+F[k].sev},b);var tt=el('text',{x:bx+13,y:91,'text-anchor':'middle','class':'bdt'},b);tt.textContent=k});
 });
 (dg.activations||[]).forEach(function(a){var x=X[a.lifeline];if(!byN[a.from]||!byN[a.to])return;el('rect',{x:x-5,y:byN[a.from]._y-10,width:10,height:byN[a.to]._y-byN[a.from]._y+18,'class':'act'},gLL)});
 M.forEach(function(m){if(m.section)return;
  var fx=rowF[m._n]||[];
  var hit=el('rect',{x:0,y:m._y-17,width:W,height:30,'class':'hit','data-n':m._n},gHit);
  var g=el('g',{'class':'row fx','data-f':fx.join(' '),'data-n':m._n,tabindex:'0',role:'button','aria-label':U.step+' '+m._n+': '+m.label},gRows);
  el('circle',{cx:44,cy:m._y-2,r:10,'class':'num st-'+m.st},g);
  var nt=el('text',{x:44,y:m._y+2,'text-anchor':'middle','class':'numt'},g);nt.textContent=m._n;
  var lx,ly;
  if(m.from===m.to){var sx=X[m.from]+5;el('path',{d:'M'+sx+' '+(m._y-8)+'h26v12h-24','class':'msg','marker-end':'url(#'+mid+')'},g);lx=sx+34;ly=m._y+2}
  else{var x1=X[m.from],x2=X[m.to],dir=x2>x1?1:-1;x1+=dir*(ACT[m.from]?5:0);x2-=dir*(ACT[m.to]?5:0);
   el('line',{x1:x1,x2:x2,y1:m._y+2,y2:m._y+2,'class':'msg'+(m.ret?' ret':''),'marker-end':'url(#'+mid+')'},g);lx=Math.min(x1,x2)+8;ly=m._y-4}
  var tx=el('text',{x:lx,y:ly,'class':'lbl','data-n':m._n},g);tx.appendChild(document.createTextNode(m.label));
  if(m.code){var cs=el('tspan',{'class':'code'},tx);cs.textContent='  → '+m.code}
  fx.forEach(function(k,i){var b=el('g',{'class':'bd'},g);el('rect',{x:W-84+i*30,y:m._y-10,width:26,height:15,rx:4,'class':'sev-'+F[k].sev},b);var bt=el('text',{x:W-71+i*30,y:m._y+1,'text-anchor':'middle','class':'bdt'},b);bt.textContent=k});
  function pick(){showRow(m._n)}
  g.addEventListener('click',pick);hit.addEventListener('click',pick);
  g.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}});
 });
 function showRow(nn){var m=byN[nn];
  gHit.querySelectorAll('.hit').forEach(function(h){h.classList.toggle('sel',+h.getAttribute('data-n')===nn)});
  var fx=rowF[nn]||[];
  var html='<div class="k">'+esc(U.step)+' '+nn+'</div><p><b>'+esc(m.label)+'</b>'+(m.code?' <span style="color:var(--err);font-weight:650">→ '+esc(m.code)+'</span>':'')+'</p>'+(m.detail?'<p>'+esc(m.detail)+'</p>':'')+(m.src?'<p class="mono" style="color:var(--muted)">'+esc(m.src)+'</p>':'');
  if(fx.length){html+='<p>'+esc(U.related)+' '+fx.map(function(k){return '<button class="chip" data-go="'+k+'"><span class="dot sev-'+F[k].sev+'"></span>'+k+' · '+esc(F[k].title)+'</button>'}).join(' ')+'</p>'}
  det.innerHTML=html;
  det.querySelectorAll('[data-go]').forEach(function(b){b.addEventListener('click',function(){activate(b.getAttribute('data-go'),true)})});
 }
 VIEW[dg.id]={svg:svg,names:names,title:dg.title||''};
}

D.diagrams.forEach(draw);

var chips=document.getElementById('chips');
function chip(id,label,sev){var b=document.createElement('button');b.className='chip';b.setAttribute('data-f',id);b.innerHTML=(sev?'<span class="dot sev-'+sev+'"></span>':'')+esc(label);b.addEventListener('click',function(){activate(id)});chips.appendChild(b)}
chip('all',U.no_filter);D.findings.forEach(function(f){chip(f.id,f.id+' · '+f.status,f.sev)});
function focusText(f){
 if(!f.anchors||!f.anchors.length)return '<b>'+f.id+'</b> · '+esc(f.title)+'. '+esc(U.no_anchor)+'.';
 return '<b>'+f.id+'</b> · '+esc(f.title)+'. '+f.anchors.map(function(a){var v=VIEW[a.diagram];
  return (D.multi&&v.title?'<b>'+esc(v.title)+'</b>: ':'')+esc(U.components)+': '+(a.lifelines||[]).map(function(l){return '<code>'+esc(v.names[l])+'</code>'}).join(', ')+'. '+esc(U.steps)+': '+((a.steps||[]).join(', ')||'-')+'.'}).join(' ');
}
function activate(id,force){cur=(id==='all'||(!force&&cur===id))?null:id;
 chips.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('on',c.getAttribute('data-f')===(cur||'all'))});
 Object.keys(VIEW).forEach(function(k){var svg=VIEW[k].svg;svg.classList.toggle('filtering',!!cur);
  svg.querySelectorAll('.fx').forEach(function(g){var ids=(g.getAttribute('data-f')||'').split(' ');g.classList.toggle('on',!!cur&&ids.indexOf(cur)>-1)})});
 document.getElementById('focus').innerHTML=cur?focusText(F[cur]):'';
}
document.querySelectorAll('.findings [data-go], .box [data-go]').forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-go');activate(id,true);
 var f=F[id],target=(f&&f.anchors&&f.anchors.length)?document.getElementById('fig-'+f.anchors[0].diagram):document.getElementById('flow');
 if(target)target.scrollIntoView({behavior:'smooth'})})});
var h=(location.hash||'').match(/^#f=([A-Za-z0-9_-]+)$/);
activate(h&&F[h[1]]?h[1]:'all',true);
})();
