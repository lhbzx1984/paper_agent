-- 文献分析：基于题目与大纲生成的「本篇论文」实验与验证设计方案
ALTER TABLE document_analysis
  ADD COLUMN IF NOT EXISTS paper_experiment_design text;
