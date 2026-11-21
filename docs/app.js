'use strict';
(() => {
 const D=window.REPORT_DATA;
 const $=s=>document.querySelector(s), F=(n,d=4)=>n==null?'NA':Number(n).toFixed(d), N=n=>n==null?'NA':Number(n).toLocaleString('en-US');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!D){$('main').insertAdjacentHTML('afterbegin','<div class="callout">数据未加载：请保持index.html、app.js、data.js及assets文件夹在同一报告目录中。</div>');return;}
 const currentLabels={frozen_source:'冻结源模型对照 · 0.6',camera_finetune:'定向微调对照 · 0.6',roi_boundary_refine:'道路ROI条件迁移模型 · 0.6',source_validation_calibrated:'源模型验证校准 · 0.1',target_validation_calibrated:'道路ROI条件迁移模型 · 验证0.7'};
 D.methods.forEach(m=>{m.label=currentLabels[m.id]||m.label;});
 const methodNames=Object.fromEntries(D.methods.map(m=>[m.id,m.label]));
 let method='target_validation_calibrated',list=[],index=0;
 const row=(a)=>'<tr>'+a.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
 const P=window.CURRENT_PROTOCOL;
 if(P){
  $('#runtime-table').innerHTML='<table><thead><tr><th>方案（原0.6推理）</th><th>图数</th><th>均值 ms/张</th><th>中位数 ms/张</th><th>P95 ms/张</th><th>首张 ms</th><th>60张计时段合计 s</th></tr></thead><tbody>'+P.timing.map(r=>row([esc(methodNames[r.method]),r.images,F(r.mean_ms,2),F(r.median_ms,2),F(r.p95_ms,2),F(r.first_image_ms,2),F(r.recorded_inference_total_seconds,3)])).join('')+'</tbody></table>';
  $('#training-time-table').innerHTML='<table><thead><tr><th>训练配置</th><th>实际轮数</th><th>验证选中轮次</th><th>登记耗时 s</th><th>登记耗时 min</th></tr></thead><tbody>'+P.training_time.map(r=>row([esc(methodNames[r.method]),r.epochs,r.selected_epoch,F(r.elapsed_seconds,2),F(r.elapsed_minutes,2)])).join('')+'</tbody></table>';
  const t=P.timing.find(r=>r.method==='roi_boundary_refine');
  $('#hero-runtime').textContent=F(t.mean_ms,2)+' ms';
  $('#runtime-detail').textContent=`道路ROI条件迁移模型的单张计时段均值为${F(t.mean_ms,2)} ms，中位数${F(t.median_ms,2)} ms，P95为${F(t.p95_ms,2)} ms，观测范围${F(t.min_ms,2)}—${F(t.max_ms,2)} ms。另一次独立启动的单图部署核对记录为${F(P.standalone_smoke.recorded_inference_ms,2)} ms（相同计时边界，只有1张），不与批量运行日志混作稳定单张延迟，也不替代未登记的端到端耗时。`;
 }
 $('#summary-table tbody').innerHTML=D.methods.map(m=>`<tr class="${m.id==='roi_boundary_refine'?'highlight':''}"><td>${esc(m.label)}</td><td>${m.threshold.toFixed(1)}</td>${['precision','recall','f1','iou'].map(k=>`<td>${F(m.summary[k])}</td>`).join('')}<td>${N(m.summary.fp)}</td><td>${N(m.summary.fn)}</td></tr>`).join('');
 $('#ap-table').innerHTML='<table><thead><tr><th>同一道路ROI内的模型</th><th>精确AP（非分箱）</th><th>道路正 / 负像素</th></tr></thead><tbody>'+D.ap.map(r=>row([esc(methodNames[r.method]),F(r.exact_AP,6),N(r.positive_pixels)+' / '+N(r.negative_pixels)])).join('')+'</tbody></table>';
 const wanted=['roi_boundary_refine','target_validation_calibrated'];
 $('#ci-table').innerHTML='<table><thead><tr><th>相对源0.6</th><th>指标</th><th>差值</th><th>95% CI</th><th>两误差联合用97.5% CI</th></tr></thead><tbody>'+D.ci.filter(r=>wanted.includes(r.method)&&['f1','iou','fp','fn'].includes(r.metric)).map(r=>{const dec=['fp','fn'].includes(r.metric)?1:6;return row([esc(methodNames[r.method]),r.metric.toUpperCase(),F(r.difference,dec),`[${F(r.ci95_low,dec)}, ${F(r.ci95_high,dec)}]`,r.ci975_low==null?'—':`[${F(r.ci975_low,1)}, ${F(r.ci975_high,1)}]`]);}).join('')+'</tbody></table>';
 $('#method').innerHTML=D.methods.map(m=>`<option value="${m.id}">${esc(m.label)}</option>`).join('');$('#method').value=method;
 const cameras=[...new Set(D.frames.map(f=>f.camera_id))].sort();
 $('#camera-filter').insertAdjacentHTML('beforeend',cameras.map(c=>`<option value="${c}">${c}</option>`).join(''));
 const delta=f=>{const a=f.methods[method].iou,b=f.methods.frozen_source.iou;return a==null||b==null?null:a-b;};
 function rebuild(keep){
  const camera=$('#camera-filter').value,g=$('#gt-filter').value,s=$('#sort').value;
  list=D.frames.filter(f=>(camera==='all'||f.camera_id===camera)&&(g==='all'||(g==='positive'?f.gt_pixels>0:f.gt_pixels===0)));
  list.sort((a,b)=>{let x,y;
   if(s==='time')return a.observed_time_utc.localeCompare(b.observed_time_utc)||a.camera_id.localeCompare(b.camera_id);
   if(s.startsWith('iou')){x=a.methods[method].iou;y=b.methods[method].iou;}
   else if(s.startsWith('fp')){x=a.methods[method].fp;y=b.methods[method].fp;}
   else if(s.startsWith('fn')){x=a.methods[method].fn;y=b.methods[method].fn;}
   else{x=delta(a);y=delta(b);}
   if(x==null&&y==null)return a.image_id.localeCompare(b.image_id);if(x==null)return 1;if(y==null)return -1;
   return (s.endsWith('asc')?x-y:y-x)||a.image_id.localeCompare(b.image_id);
  });
  index=Math.max(0,list.findIndex(f=>f.image_id===keep));render();gallery();cameraTable();
 }
 function pane(f,title,layer){return `<figure class="image-pane" tabindex="0" role="button" aria-label="放大${esc(title)}"><figcaption>${title}</figcaption><div class="image-stack" style="aspect-ratio:${f.width}/${f.height}"><img src="${f.original}" alt="${esc(f.image_id)} 原图" decoding="async">${layer?`<img src="${layer}" class="mask-layer" alt="${esc(title)} 覆盖图" decoding="async">`:''}</div></figure>`;}
 function tri(f){const m=f.methods[method],err=$('#error-mode').checked;return pane(f,'原始图像',null)+pane(f,'人工道路内冰雪 GT',f.gt_overlay)+pane(f,err?'预测误差 · 红FP / 蓝FN':`道路内冰雪预测 · 阈值${m.threshold.toFixed(1)}`,err?m.error:m.overlay);}
 function render(){
  if(!list.length){$('#triptych').innerHTML='<div class="empty">该筛选条件没有图像，请调整筛选。</div>';$('#frame-title').textContent='没有符合条件的图像';$('#position').textContent='0 / 0';return;}
  const f=list[index],m=f.methods[method];
  $('#frame-title').textContent=f.image_id;
  $('#frame-info').textContent=`机位 ${f.camera_id} · ${f.observed_time_utc} (UTC) · ${f.width}×${f.height} · ${f.camera_name}`;
  $('#position').textContent=`${index+1} / ${list.length}`;$('#prev').disabled=index===0;$('#next').disabled=index===list.length-1;
  $('#triptych').innerHTML=tri(f);
  $('#triptych').querySelectorAll('.image-pane').forEach(p=>{p.onclick=()=>openFull();p.onkeydown=e=>{if(e.key==='Enter')openFull();};});
  $('#frame-metrics').innerHTML=[['Precision',F(m.precision)],['Recall',F(m.recall)],['F1',F(m.f1)],['IoU',F(m.iou)],['FP 像素',N(m.fp)],['FN 像素',N(m.fn)],['GT冰雪像素',N(f.gt_pixels)]].map(([k,v])=>`<div><small>${k}</small><strong>${v}</strong></div>`).join('');
  $('#frame-explanation').textContent=`${methodNames[method]}；道路ROI ${N(f.road_pixels)} 像素。原始ice GT道路外有 ${N(f.raw_ice_outside_road)} 像素，均保留在源GT但不进入道路内评价。${m.iou==null?'该图GT与预测均为空，F1/IoU记NA，不按完美分计算。':f.gt_pixels===0?'人工道路内确认无冰雪，本图主要查看FP。':'绿色为当前方案的道路内冰雪；若覆盖不足请结合蓝色FN查看。'}`;
  document.querySelectorAll('.thumb').forEach(t=>t.classList.toggle('selected',t.dataset.id===f.image_id));
 }
 function gallery(){
  const n=Math.min(12,list.length);let ids=[];for(let i=0;i<n;i++)ids.push(n===1?0:Math.round(i*(list.length-1)/(n-1)));
  $('#gallery-description').textContent=`当前筛选共${list.length}张；按当前排序等距抽取${n}个名次。切换“有冰雪”可查看35张正例的高到低IoU分位样本；无雪负例不从完整结果中删除。`;
  $('#gallery').innerHTML=ids.map(i=>{const f=list[i],m=f.methods[method];return `<button class="thumb ${i===index?'selected':''}" data-id="${f.image_id}"><img src="${f.original}" loading="lazy" decoding="async" alt="${esc(f.image_id)} 缩略图"><span class="thumb-text"><b>#${i+1} · IoU ${F(m.iou)}</b><span>${f.camera_id} · ${f.gt_pixels>0?'有冰雪':'无冰雪'}</span><small>FP ${N(m.fp)} / FN ${N(m.fn)}</small><small>${esc(f.image_id)}</small></span></button>`;}).join('');
  $('#gallery').querySelectorAll('button').forEach(b=>b.onclick=()=>{index=list.findIndex(f=>f.image_id===b.dataset.id);render();$('#triptych').scrollIntoView({block:'center',behavior:'smooth'});});
 }
 function cameraTable(){
  const labels={early_negative_later_negative:'早期/后期均无雪',early_positive_later_negative:'早期有雪→后期无雪',early_positive_later_positive:'早期/后期均曾有雪'};
  const rr=D.camera.filter(r=>r.method===method).sort((a,b)=>a.camera_id.localeCompare(b.camera_id));
  $('#camera-table').innerHTML='<table><thead><tr><th>机位</th><th>后期图数</th><th>GT标签状态</th><th>Precision</th><th>Recall</th><th>F1</th><th>IoU</th><th>FP</th><th>FN</th><th>相对源IoU差</th></tr></thead><tbody>'+rr.map(r=>{const b=D.camera.find(x=>x.method==='frozen_source'&&x.camera_id===r.camera_id),d=r.iou==null||b.iou==null?null:r.iou-b.iou;const st=D.strata.find(x=>x.camera_id===r.camera_id);return row([`<a href="#inspector" data-camera="${r.camera_id}">${r.camera_id}</a>`,r.image_count,labels[st.GT_label_stratum],F(r.precision),F(r.recall),F(r.f1),F(r.iou),N(r.fp),N(r.fn),`<span class="${d==null?'':d>=0?'good':'bad'}">${d==null?'NA':(d>=0?'+':'')+F(d)}</span>`]);}).join('')+'</tbody></table>';
  $('#camera-table').querySelectorAll('a').forEach(a=>a.onclick=()=>{$('#camera-filter').value=a.dataset.camera;$('#gt-filter').value='all';rebuild();});
 }
 function openFull(){if(!list.length)return;const f=list[index];$('#zoom-title').textContent=f.image_id+' · '+methodNames[method];$('#zoom-content').innerHTML='<div class="triptych">'+tri(f)+'</div>';$('#zoom-dialog').showModal();}
 function csvString(rows){const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n');}
 $('#export-filter').onclick=()=>{
  const h=['method','threshold','image_id','camera_id','time_utc','GT_road_ice_pixels','tp','fp','fn','precision','recall','f1','iou'];
  const r=list.map(f=>{const m=f.methods[method];return [method,m.threshold,f.image_id,f.camera_id,f.observed_time_utc,f.gt_pixels,m.tp,m.fp,m.fn,m.precision,m.recall,m.f1,m.iou];});
  const blob=new Blob([csvString([h,...r])],{type:'text/csv;charset=utf-8'}),a=document.createElement('a'),u=URL.createObjectURL(blob);
  a.href=u;a.download=`roadcarea_${method}_${list.length}_images.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);
 };
 $('#method').onchange=()=>{const keep=list[index]?.image_id;method=$('#method').value;rebuild(keep);};
 for(const s of ['#camera-filter','#gt-filter','#sort'])$(s).onchange=()=>rebuild();
 $('#prev').onclick=()=>{if(index>0){index--;render();}};$('#next').onclick=()=>{if(index<list.length-1){index++;render();}};
 $('#error-mode').onchange=()=>render();$('#open-full').onclick=openFull;
 $('#close-dialog').onclick=()=>$('#zoom-dialog').close();
 $('#zoom-dialog').addEventListener('click',e=>{if(e.target===$('#zoom-dialog'))$('#zoom-dialog').close();});
 document.querySelectorAll('.zoomable').forEach(im=>im.onclick=()=>{$('#zoom-title').textContent=im.alt;$('#zoom-content').innerHTML=`<img src="${im.getAttribute('src')}" alt="${esc(im.alt)}">`;$('#zoom-dialog').showModal();});
 document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{$('#camera-filter').value='all';$('#gt-filter').value='all';rebuild(b.dataset.case);$('#inspector').scrollIntoView();});
 $('#show-negatives').onclick=()=>{$('#camera-filter').value='all';$('#gt-filter').value='negative';$('#sort').value='fp_desc';rebuild();$('#inspector').scrollIntoView();};
 document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)||$('#zoom-dialog').open)return;if(e.key==='ArrowLeft')$('#prev').click();if(e.key==='ArrowRight')$('#next').click();});
 $('#print').onclick=()=>window.print();
 $('#fingerprints').textContent=`checkpoint SHA256: ${D.deployment.checkpoint_sha256}\n模板清单 SHA256: ${D.deployment.templates_sha256}\n部署候选 threshold: ${D.deployment.ice_threshold}`;
 $('#fingerprints').style.whiteSpace='pre-wrap';
 $('#build-time').textContent=(P?.generated_at||D.generated_local).replace('T',' ')+' (Asia/Shanghai)';
 rebuild();
})();
