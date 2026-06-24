"use client";



import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/Sidebar";

import { Button } from "@/components/ui/Button";

import { Input } from "@/components/ui/Input";

import { cn } from "@/lib/utils";

import {

  Activity,

  Footprints,

  Flame,

  HeartPulse,

  Moon,

  Droplet,

  Scale,

  Ruler,

  Pencil,

  Check,

  Watch,

  Info,

} from "lucide-react";



interface HealthData {

  weightLb: number;

  heightIn: number;

  steps: number;

  stepGoal: number;

  caloriesBurned: number;

  caloriesGoal: number;

  restingHeartRate: number;

  sleepHours: number;

  waterCups: number;

  waterGoal: number;

}



const DEFAULT_DATA: HealthData = {

  weightLb: 170,

  heightIn: 70,

  steps: 6500,

  stepGoal: 10000,

  caloriesBurned: 520,

  caloriesGoal: 700,

  restingHeartRate: 68,

  sleepHours: 7,

  waterCups: 5,

  waterGoal: 8,

};



const STORAGE_KEY = "health-data-v1";



function computeBMI(weightLb: number, heightIn: number): number {

  if (!heightIn) return 0;

  return Math.round(((weightLb / (heightIn * heightIn)) * 703) * 10) / 10;

}



function bmiCategory(bmi: number): { label: string; color: string } {

  if (bmi < 18.5) return { label: "Underweight", color: "text-amber-300" };

  if (bmi < 25) return { label: "Healthy", color: "text-emerald-300" };

  if (bmi < 30) return { label: "Overweight", color: "text-amber-300" };

  return { label: "Obese", color: "text-accent-rose" };

}



function StatCard({

  label,

  icon: Icon,

  children,

  footer,

}: {

  label: string;

  icon: typeof Activity;

  children: React.ReactNode;

  footer?: React.ReactNode;

}) {

  return (

    <div className="glass-panel rounded-2xl p-4 ring-1 ring-white/10">

      <div className="flex items-center gap-2 mb-2">

        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/20 ring-1 ring-pink-400/20">

          <Icon size={14} className="text-pink-300" />

        </span>

        <span className="text-sm font-medium text-ink-muted">{label}</span>

      </div>

      {children}

      {footer}

    </div>

  );

}



function Ring({ value, goal, label, Icon, unit }: { value: number; goal: number; label: string; Icon: typeof Activity; unit?: string }) {

  const pct = Math.min(100, Math.round((value / goal) * 100)) || 0;

  return (

    <StatCard label={label} icon={Icon}>

      <div className="flex items-baseline justify-between gap-2">

        <p className="text-2xl font-bold text-ink">

          {value.toLocaleString()}

          {unit && <span className="text-sm font-normal text-ink-muted"> {unit}</span>}

        </p>

        <span className="text-xs font-medium text-pink-300">{pct}%</span>

      </div>

      <p className="text-xs text-ink-muted mt-0.5">

        Goal: {goal.toLocaleString()}

        {unit ? ` ${unit}` : ""}

      </p>

      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden ring-1 ring-white/5">

        <div

          className="h-full bg-gradient-to-r from-pink-400 to-pink-300 rounded-full transition-all"

          style={{ width: `${pct}%` }}

        />

      </div>

    </StatCard>

  );

}



const DEVICES = [

  { name: "Fitbit", note: "Web API available — needs OAuth client ID/secret" },

  { name: "Garmin Connect", note: "Web API available — needs developer keys" },

  { name: "Google Fit / Health Connect", note: "On Android; REST API being retired" },

  { name: "Apple Health", note: "On-device only — needs a companion iOS app, no web API" },

];



export default function HealthPage() {

  const [data, setData] = useState<HealthData>(DEFAULT_DATA);

  const [editing, setEditing] = useState(false);

  const [draft, setDraft] = useState<HealthData>(DEFAULT_DATA);

  const [loaded, setLoaded] = useState(false);



  useEffect(() => {

    try {

      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {

        const parsed = { ...DEFAULT_DATA, ...JSON.parse(saved) };

        setData(parsed);

        setDraft(parsed);

      }

    } catch {

      /* use defaults */

    }

    setLoaded(true);

  }, []);



  const save = () => {

    setData(draft);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

    setEditing(false);

  };



  const bmi = computeBMI(data.weightLb, data.heightIn);

  const cat = bmiCategory(bmi);

  const heightFt = Math.floor(data.heightIn / 12);

  const heightInRem = data.heightIn % 12;



  if (!loaded) return null;



  const numField = (key: keyof HealthData, label: string) => (

    <Input

      label={label}

      type="number"

      value={String(draft[key])}

      onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}

    />

  );



  return (

    <div className="flex flex-col min-h-0">

      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">

        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">

          <PageHeader

            title="Health"

            subtitle="Your daily wellness at a glance"

            action={

              editing ? (

                <div className="flex gap-2">

                  <Button size="sm" onClick={save}>

                    <Check size={15} /> Save

                  </Button>

                  <Button

                    size="sm"

                    variant="outline"

                    onClick={() => {

                      setDraft(data);

                      setEditing(false);

                    }}

                  >

                    Cancel

                  </Button>

                </div>

              ) : (

                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>

                  <Pencil size={15} /> Update Values

                </Button>

              )

            }

          />

        </div>



        <div className="px-5 sm:px-6 py-5 space-y-5">

          {editing ? (

            <div className="glass-panel rounded-2xl p-5 ring-1 ring-white/10">

              <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">

                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/20 ring-1 ring-pink-400/20">

                  <Pencil size={14} className="text-pink-300" />

                </span>

                Update your metrics

              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                {numField("weightLb", "Weight (lb)")}

                {numField("heightIn", "Height (in)")}

                {numField("steps", "Steps today")}

                {numField("stepGoal", "Step goal")}

                {numField("caloriesBurned", "Calories burned")}

                {numField("caloriesGoal", "Calorie goal")}

                {numField("restingHeartRate", "Resting HR (bpm)")}

                {numField("sleepHours", "Sleep (hours)")}

                {numField("waterCups", "Water (cups)")}

                {numField("waterGoal", "Water goal (cups)")}

              </div>

            </div>

          ) : (

            <>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <StatCard label="Weight" icon={Scale}>

                  <p className="text-2xl font-bold text-ink">

                    {data.weightLb}

                    <span className="text-sm font-normal text-ink-muted"> lb</span>

                  </p>

                </StatCard>

                <StatCard label="Height" icon={Ruler}>

                  <p className="text-2xl font-bold text-ink">

                    {heightFt}&apos;{heightInRem}&quot;

                    <span className="text-sm font-normal text-ink-muted"> ({data.heightIn} in)</span>

                  </p>

                </StatCard>

                <StatCard label="BMI" icon={Activity}>

                  <p className="text-2xl font-bold text-ink">{bmi}</p>

                  <p className={cn("text-xs font-medium mt-0.5", cat.color)}>{cat.label}</p>

                </StatCard>

                <StatCard label="Resting HR" icon={HeartPulse}>

                  <p className="text-2xl font-bold text-ink">

                    {data.restingHeartRate}

                    <span className="text-sm font-normal text-ink-muted"> bpm</span>

                  </p>

                </StatCard>

              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <Ring value={data.steps} goal={data.stepGoal} label="Steps" Icon={Footprints} />

                <Ring value={data.caloriesBurned} goal={data.caloriesGoal} label="Calories" Icon={Flame} unit="kcal" />

                <Ring value={data.waterCups} goal={data.waterGoal} label="Water" Icon={Droplet} unit="cups" />

                <StatCard label="Sleep" icon={Moon}>

                  <p className="text-2xl font-bold text-ink">

                    {data.sleepHours}

                    <span className="text-sm font-normal text-ink-muted"> hrs</span>

                  </p>

                  <p className="text-xs text-ink-muted mt-0.5">

                    {data.sleepHours >= 7 ? "Well rested" : "Below 7h target"}

                  </p>

                </StatCard>

              </div>

            </>

          )}



          <div className="glass-panel rounded-2xl p-5 ring-1 ring-white/10">

            <div className="flex items-center gap-2 mb-3">

              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 ring-1 ring-pink-400/20">

                <Watch size={16} className="text-pink-300" />

              </span>

              <h3 className="text-sm font-semibold text-ink">Connect a device</h3>

            </div>

            <p className="text-sm text-ink-secondary mb-4 flex items-start gap-2">

              <Info size={14} className="flex-shrink-0 mt-0.5 text-ink-muted" />

              Auto-sync needs each provider&apos;s API keys/OAuth setup. Values above are saved on this

              device in the meantime. Apple Health has no web API, so it requires a companion iOS app.

            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {DEVICES.map((d) => (

                <div

                  key={d.name}

                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 ring-1 ring-white/5"

                >

                  <div className="min-w-0">

                    <p className="text-sm font-medium text-ink">{d.name}</p>

                    <p className="text-xs text-ink-muted">{d.note}</p>

                  </div>

                  <Button size="sm" variant="outline" disabled>

                    Connect

                  </Button>

                </div>

              ))}

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}


