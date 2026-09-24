import { invokeFunction } from '../core/supabase.js';

export const runPreflight=(examId,{allowDraftPapers=false}={})=>invokeFunction('exam-preflight',{examId,allowDraftPapers});
