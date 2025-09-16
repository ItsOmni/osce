import React, { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Download, FileText, Trophy, BookOpenCheck, AlertTriangle, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";

// --- DEV TESTS (runtime sanity checks) ---
(() => {
  const sample = "• One\n- Two\n– Three\n· Four\n‣ Five\nSix";
  const parsed = sample.split(/[\n?|•·‣–-]/g).map(s=>s.trim()).filter(Boolean);
  console.assert(parsed.length === 6, `Parser expected 6, got ${parsed.length}`);
  const eligible = (completed:number,total:number,qp:boolean)=> qp && completed === total;
  console.assert(eligible(7,7,true) === true, "Eligibility true when all sections done + quiz");
  console.assert(eligible(6,7,true) === false, "Eligibility false when sections incomplete");
})();

// --- UI PRIMITIVES ---
const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; complete?: boolean; onToggle?: () => void; defaultOpen?: boolean; }>
= ({ title, subtitle, children, complete=false, onToggle, defaultOpen=false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [done, setDone] = useState(!!complete);
  const markComplete = () => { if (done) return; setDone(true); onToggle && onToggle(); };
  return (
    <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-4 md:p-6 border border-slate-200">
      <button onClick={() => setOpen(v=>!v)} className="w-full flex items-center justify-between text-left">
        <div>
          <h3 className="text-xl md:text-2xl font-semibold flex items-center gap-3">{open ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}{title}</h3>
          {subtitle && <p className="text-slate-600 mt-1">{subtitle}</p>}
        </div>
        <div className={`flex items-center gap-2 text-sm ${done?"text-emerald-600":"text-slate-400"}`}>{done?<Check className="w-5 h-5"/>:<span className="w-5 h-5 inline-block"/>}{done?"Completed":"In progress"}</div>
      </button>
      <AnimatePresence initial={false}>{open && (
        <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="mt-4 md:mt-6 space-y-4">
          {children}
          {onToggle && (
            <div className="pt-2">
              <button onClick={markComplete} disabled={done} className="px-4 py-2 rounded-xl text-white transition disabled:bg-slate-300 disabled:cursor-not-allowed bg-emerald-600">{done?"Completed":"Mark section as complete"}</button>
            </div>
          )}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

const CodeBlock: React.FC<{ children: React.ReactNode }>=({ children })=> (
  <pre className="whitespace-pre-wrap text-sm leading-6 bg-slate-50 border rounded-xl p-4">{children}</pre>
);

const Callout: React.FC<{ type: "insight" | "pitfall"; children: React.ReactNode }>=({ type, children })=> (
  <div className={`flex items-start gap-3 border rounded-xl p-3 text-sm ${type==="insight"?"bg-emerald-50 border-emerald-200 text-emerald-800":"bg-yellow-50 border-yellow-200 text-yellow-800"}`}>
    {type==="insight"?<Lightbulb className="w-4 h-4 mt-0.5"/>:<AlertTriangle className="w-4 h-4 mt-0.5"/>}
    <div>{children}</div>
  </div>
);

// --- QUIZ (neutral knowledge) ---
const MiniQuiz: React.FC<{ questions: { q: string; options: string[]; answer: number; rationale: string }[]; onPass: ()=>void }>
= ({ questions, onPass }) => {
  const [idx, setIdx] = useState(0); const [score, setScore] = useState(0); const [picked, setPicked] = useState<number|null>(null); const [done, setDone] = useState(false);
  const current = questions[idx];
  const submit = () => { if (picked===null) return; const correct = picked===current.answer; if (correct) setScore(s=>s+1); if (idx===questions.length-1){ setDone(true); const passed=(score+(correct?1:0))/questions.length>=0.8; if(passed) onPass(); return;} setIdx(i=>i+1); setPicked(null); };
  if (done) { const passed = score / questions.length >= 0.8; return (
    <div className="p-4 rounded-xl bg-slate-100">
      <p className="font-semibold">Quiz complete — {score}/{questions.length} correct ({Math.round(100*score/questions.length)}%).</p>
      <p className="mt-1">{passed?"Nice — this meets the certificate threshold.":"You can retry to reach ≥80%."}</p>
    </div>
  ); }
  return (
    <div className="space-y-3">
      <p className="font-medium">{idx+1}. {current.q}</p>
      <div className="grid gap-2">{current.options.map((opt,i)=> (
        <label key={i} className={`border rounded-xl p-3 cursor-pointer ${picked===i?"border-slate-900 bg-slate-50":"border-slate-200"}`}>
          <input type="radio" name={`q${idx}`} className="mr-2" checked={picked===i} onChange={()=>setPicked(i)} />{opt}
        </label>
      ))}</div>
      {picked!==null && (
        <div className={`p-3 rounded-xl ${picked===current.answer?"bg-emerald-50 border border-emerald-200":"bg-rose-50 border border-rose-200"}`}>
          <p className="text-sm"><span className="font-semibold">Rationale: </span>{current.rationale}</p>
        </div>
      )}
      <div><button onClick={submit} className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white">{idx===questions.length-1?"Finish":"Next"}</button></div>
    </div>
  );
}

// --- PROGRESS ---
function useProgress(sections: string[]) {
  const [completeSet, setCompleteSet] = useState<Record<string, boolean>>(()=>Object.fromEntries(sections.map(s=>[s,false])));
  const setComplete = (k: string, v: boolean)=> setCompleteSet(prev=> ({...prev, [k]: v}));
  const value = useMemo(()=>{ const total = sections.length; const n = Object.values(completeSet).filter(Boolean).length; return { n, total, pct: Math.round(100*n/total), completeSet, setComplete }; },[completeSet, sections.join(",")]);
  return value;
}

// --- DATA (Updated, knowledge‑focused & neutral) ---
const questions = [
  {
    q: "Cardio exam: You hear a pansystolic murmur loudest at the apex, radiating to the axilla. Which diagnosis is most likely, and what is the single best initial investigation?",
    options: [
      "Mitral regurgitation — transthoracic echocardiogram",
      "Aortic stenosis — chest X-ray",
      "Aortic regurgitation — troponin",
      "Hypertrophic cardiomyopathy — BNP"
    ],
    answer: 0,
    rationale: "A pansystolic murmur at the apex radiating to the axilla is classic for MR; first-line test is a transthoracic echo."
  },
  {
    q: "Feverish patient in A–E: Temp 39.1°C, HR 118, RR 24, BP 104/62, suspected UTI source. Which investigation is the most useful to obtain immediately as part of initial management?",
    options: [
      "Serum lactate",
      "CRP",
      "CT KUB",
      "Procalcitonin"
    ],
    answer: 0,
    rationale: "In suspected sepsis, measuring lactate early (Sepsis Six) helps risk-stratify and guide resuscitation."
  },
  {
    q: "Resp exam: Reduced expansion on the right, stony dull percussion at the base, decreased breath sounds, and reduced vocal resonance. What is the most likely diagnosis and best initial imaging?",
    options: [
      "Pleural effusion — erect chest X-ray",
      "Consolidation — high-resolution CT",
      "Pneumothorax — abdominal ultrasound",
      "Asthma — peak flow diary"
    ],
    answer: 0,
    rationale: "Dullness + ↓ breath sounds + ↓ vocal resonance suggests effusion; start with an erect CXR."
  },
  {
    q: "Abdo exam: RUQ pain, fever, and a positive Murphy’s sign. What is the most appropriate first-line imaging?",
    options: [
      "Right upper quadrant ultrasound",
      "CT abdomen/pelvis with contrast",
      "MRCP",
      "Erect chest X-ray"
    ],
    answer: 0,
    rationale: "Acute cholecystitis is best assessed initially with RUQ ultrasound (gallstones, wall thickening, pericholecystic fluid)."
  },
  {
    q: "Neuro/Stroke A–E: Sudden right-sided weakness and facial droop 30 minutes ago. Vitals stable. What is the single best immediate investigation?",
    options: [
      "Urgent non-contrast CT head",
      "MRI brain with diffusion-weighted imaging",
      "Carotid Doppler ultrasound",
      "Echocardiogram"
    ],
    answer: 0,
    rationale: "Non-contrast CT rapidly differentiates haemorrhage from ischaemia and is the immediate step in suspected acute stroke."
  }
];


// --- CERTIFICATE ---
const Certificate: React.FC<{ name: string; date: string; onDownload: ()=>void }>=({ name, date, onDownload })=> (
  <div className="bg-white rounded-2xl border shadow p-6 text-center">
    <div className="flex justify-center mb-4"><Trophy className="w-10 h-10"/></div>
    <h3 className="text-2xl font-bold">Certificate of Completion</h3>
    <p className="mt-2">This certifies that</p>
    <p className="text-xl font-semibold mt-1">{name || "[Your name]"}</p>
    <p className="mt-2">has completed the <span className="font-medium">An introduction to OSCEs</span> e-learning led by <span className="font-medium">Dr Hussain Hilali</span>.</p>
    <p className="mt-2 text-sm text-slate-600">Date: {date}</p>
    <button onClick={onDownload} className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white flex items-center gap-2 mx-auto"><Download className="w-4 h-4"/>Download as PDF</button>
  </div>
);

// --- MARKSCHEME BUILDER ---
const MarkschemeBuilder: React.FC = ()=>{
  const [raw, setRaw] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const parse = ()=>{
    const lines = raw.split(/[\n?|•·‣–-]/g).map((l)=>l.trim()).filter(Boolean);
    setItems(lines);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Paste bullet points from a mark scheme below (one per line). We’ll convert them into a simple list you can rehearse against or print.</p>
      <textarea value={raw} onChange={e=>setRaw(e.target.value)} className="w-full h-40 border rounded-xl p-3" placeholder={`e.g.\nIntroduce self, confirm patient identity\nWash hands / PPE\nOpen question about presenting complaint\n...`}></textarea>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white flex items-center gap-2" onClick={parse}><FileText className="w-4 h-4"/>Build list</button>
        {items.length>0 && <span className="text-slate-500 self-center">{items.length} items</span>}
      </div>
      {items.length>0 && (
        <div className="mt-4 border rounded-2xl p-4">
          <ol className="list-decimal ml-5 space-y-1">{items.map((t,i)=> <li key={i}>{t}</li>)}</ol>
        </div>
      )}
    </div>
  );
}

// --- APP ---
export default function OSCEElearning() {
  const SECTIONS = ["Intro","History","Examinations","A-E","General Tips","Quiz","Resources"];
  const { n, total, pct, setComplete, completeSet } = useProgress(SECTIONS);
  const [learnerName, setLearnerName] = useState("");
  const [quizPassed, setQuizPassed] = useState(false);
  const eligible = quizPassed && Object.values(completeSet).filter(Boolean).length === total;
  const today = useMemo(()=> new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" }),[]);
  const downloadCert = () => { const doc = new jsPDF({ unit: "pt", format: "a4" }); doc.setFont("helvetica","bold"); doc.setFontSize(22); doc.text("Certificate of Completion", 72, 120); doc.setFontSize(12); doc.setFont("helvetica","normal"); const lines=["This certifies that "+(learnerName||"[Your name]")+" has completed the","An introduction to OSCEs e-learning led by Dr Hussain Hilali.","Date: "+today]; lines.forEach((l,i)=> doc.text(l, 72, 160 + i*22)); doc.save(`OSCE_Introduction_Certificate_${learnerName||"Student"}.pdf`); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <header className="mb-6 md:mb-10">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">An introduction to OSCEs</h1>
          <p className="text-slate-600 mt-2">A pragmatic, friendly guide for earlier‑year medical students. These are practical habits that helped me — use what helps, ignore what doesn’t.</p>
          <div className="mt-4 flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="w-full md:w-1/2 bg-slate-200 rounded-xl overflow-hidden"><div className="h-3 bg-slate-900" style={{ width: `${pct}%` }} /></div>
            <div className="text-sm text-slate-600">Progress: {n}/{total} sections ({pct}%)</div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input value={learnerName} onChange={e=>setLearnerName(e.target.value)} placeholder="Your full name for the certificate" className="w-full sm:w-96 border rounded-xl p-3"/>
            <div className="flex items-center gap-2 text-sm text-slate-600"><BookOpenCheck className="w-4 h-4"/>Complete sections + pass quiz (≥80%) to unlock certificate.</div>
          </div>
        </header>

        {/* Intro */}
        <SectionCard title="What an OSCE really is" subtitle="A constrained performance — optimise for what’s assessed" onToggle={()=>setComplete("Intro", true)} complete={completeSet["Intro"]} defaultOpen>
  <div className="prose max-w-none space-y-4">
    <p>When you first start preparing for OSCEs, it’s important to recognise what they actually are—and what they aren’t. Medical schools often describe OSCEs as simulations of clinical scenarios, but they are not the same as real-life practice. In reality, an OSCE is a performance: time-limited, goal-driven, and built around a script rather than the complexity of a real patient encounter. Unlike in the ward, where you think about holistic care and long-term management, in an OSCE you usually have a single, tightly defined task—take a history, perform an examination, or explain a diagnosis—within a fixed timeframe. The “patient” is often an actor with only a couple of pages of scripted information, so you can only ever extract what has been written into the station. And while in clinical life the patient is always the focus, in an OSCE the person who really matters is the examiner: they hold the marksheet and ultimately decide whether you pass. The key, then, is not just interacting with the patient but presenting your skills in a way that makes it as easy as possible for the examiner to award you marks.</p>
  </div>
</SectionCard>

        {/* History */}
        <SectionCard title="History — simple, human structure" subtitle="Efficient, structured information gathering" onToggle={()=>setComplete("History", true)} complete={completeSet["History"]}>
  <div className="prose max-w-none space-y-4">
    <p>The history is the bread and butter of OSCEs and one of the first skills you’ll be expected to master. At its core, every history station is about one thing: extracting the script. The “patient” is an actor with a limited set of information written down, and your job is to uncover it efficiently. The good news is that almost every history follows the same structure, with only minor variations depending on the presenting complaint. Examiners will nearly always award marks for the fundamentals: washing your hands or donning PPE, introducing yourself, gaining consent, and asking about allergies, background history (past medical, drug, family, and social history). These are reliable points you can bank every time.</p>
    <p>The main bulk of the station is the history of the presenting complaint. Here, structured approaches are your best friend. For pain, “SOCRATES” works well; for other complaints, “OPERATES” is a useful alternative. Add in red flag symptoms and a brief systems review, and you will have covered most mark schemes comprehensively. The real challenge lies not in what to ask but in doing it under time pressure, which is why developing a smooth, systematic flow is key.</p>
    <p>Beyond ticking the boxes, what separates a competent history from an excellent one are soft skills: maintaining calm body language, smiling, listening attentively, and making the interaction feel like a natural conversation rather than an interrogation. A particularly powerful tool is ICE—Ideas, Concerns, and Expectations. Many people leave this to the end, but asking it early can save time and sharpen your differentials, especially in vague cases like “tired all the time.” Finally, remember that open questions are more powerful in OSCEs than in real life: they compel the actor to give you the information from the script, and once that script is exhausted, there’s nothing more to find. In short, history-taking in an OSCE is about balancing structure, efficiency, and rapport—while always keeping the examiner’s marksheet in mind.</p>
  </div>
</SectionCard>

        {/* Examinations */}
<SectionCard title="Examinations — sequencing, memorisation, discipline" subtitle="Structure over flair; practise until automatic" onToggle={()=>setComplete("Examinations", true)} complete={completeSet["Examinations"]}>
  <div className="prose max-w-none space-y-4">
    <p>Examinations in OSCEs are often less about communication skills and more about memorisation, sequencing, and discipline. Unlike histories, where rapport and soft skills can make a big difference, examinations are usually marked against a rigid checklist. The aim isn’t necessarily to find pathology—indeed, many actors won’t have any—but to demonstrate a thorough, structured approach that covers all the essential steps. What examiners really want to see is a logical, well-sequenced examination that they can follow easily, rather than a rushed attempt to jump to diagnoses.</p>
    <p>The only way to get comfortable with this is practice. Rehearse examinations again and again—on friends, on a pillow, even just by talking them through aloud—until each sequence becomes second nature. Say out loud the signs you are looking for, and familiarise yourself with their appearances by reviewing images and videos. The more ingrained this becomes, the smoother your performance will be on the day.</p>
    <p>What often catches students out are the simple things: forgetting to wash hands, neglecting to observe for bedside clues, skipping basic checks like JVP assessment or hepatojugular reflux, or failing to consider appropriate investigations. These are easy marks that can make the difference between just scraping through and excelling. Once the fundamentals are secure, it’s the small nuances and smooth time management that set top candidates apart. Practising under timed conditions is crucial—because in an OSCE, precision and pace are just as important as thoroughness.</p>
  </div>
</SectionCard>


        {/* A–E */}
<SectionCard title="A–E — one framework, every time" subtitle="Consistency through the sweep + confident handover" onToggle={()=>setComplete("A-E", true)} complete={completeSet["A-E"]}>
  <div className="prose max-w-none space-y-4">
    <p>When it comes to A–E assessments, the key is not to think of them as different exams for different conditions. You are not doing a “DKA A–E” or a “pneumonia A–E”—you are simply applying the same structured framework every time. The purpose of A–E is to give you a reliable way of working through emergencies in a consistent, logical manner. You are checking the same systems, looking for the same signs, and ordering the same baseline investigations, regardless of the underlying diagnosis.</p>
    <p>The more familiar you are with what to look for—specific sounds on auscultation, clinical signs, common abnormalities, and the standard interventions—the smoother this becomes. The patient’s picture will often evolve as you go along: if you apply the correct treatments (for example, giving oxygen), the patient should improve, and you can always cycle back through the steps to reassess progress.</p>
    <p>A common pitfall is forgetting that many A–E stations include a handover to a senior at the end. Candidates sometimes put all their focus into the A–E itself, only to give a weak, incomplete handover—forgetting basics like the patient’s name, date of birth, or the key features that actually distinguish the diagnosis. To avoid this, practise not only the A–E itself but also the handover that follows. Learn how to deliver concise, well-structured summaries that highlight the most important distinguishing features—for instance, a VBG result or high glucose in DKA, or pinpoint pupils in opioid overdose. Done well, this shows both clinical reasoning and professional communication, and it can earn you crucial marks that others miss.</p>
  </div>
</SectionCard>


        {/* General tips */}
        <SectionCard title="General tips that quietly win marks" subtitle="Bank easy marks; rehearse under time" onToggle={()=>setComplete("General Tips", true)} complete={completeSet["General Tips"]}>
          <div className="prose max-w-none space-y-4">
            <ul className="list-disc ml-5">
              <li>Bank the freebies: hand hygiene, PPE, name/role, consent, and a clear close.</li>
              <li>If you finish a touch early, add a holistic step or a one‑line safety‑net rather than rambling.</li>
              <li>Collect local mark schemes — every school has quirks. Practise to <em>your</em> exam.</li>
            </ul>
          </div>
        </SectionCard>

        {/* Quiz */}
        <SectionCard title="5‑question clinical check" subtitle="Score ≥80% to unlock the certificate" onToggle={()=>setComplete("Quiz", true)} complete={completeSet["Quiz"]}>
          <MiniQuiz questions={questions} onPass={()=>setQuizPassed(true)} />
        </SectionCard>

        {/* Resources */}
        <SectionCard title="Further resources" subtitle="Use these once the strategy makes sense" onToggle={()=>setComplete("Resources", true)} complete={completeSet["Resources"]}>
          <div className="prose max-w-none space-y-2">
            <p><a href="https://geekymedics.com/" target="_blank" rel="noreferrer" className="underline">Geeky Medics</a> — station walk‑throughs and checklists.</p>
            <p><a href="https://zerotofinals.com/" target="_blank" rel="noreferrer" className="underline">Zero to Finals</a> — concise notes when you’re short on time.</p>
            <p><a href="https://passmedicine.com/" target="_blank" rel="noreferrer" className="underline">Passmedicine OSCE practice</a> — scenarios and question banks.</p>
          </div>
        </SectionCard>

        {/* Certificate */}
        <div className="mt-8">
          <SectionCard title="Certificate" subtitle="Unlocks when you finish" complete={eligible}>
            {eligible ? (
              <Certificate name={learnerName} date={today} onDownload={downloadCert} />
            ) : (
              <div className="p-4 rounded-2xl bg-yellow-50 border border-yellow-200"><p className="font-medium">Keep going</p><p className="text-sm text-slate-700">Complete all sections and pass the 5‑question check to unlock your certificate.</p></div>
            )}
          </SectionCard>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-500">© {new Date().getFullYear()} Hussain Hilali · Education only; not a substitute for clinical supervision.</footer>
      </div>
    </div>
  );
}
