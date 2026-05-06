#!/usr/bin/env python3
import json, sys
from pathlib import Path
import numpy as np, pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl

mpl.rcParams.update({"figure.dpi": 110, "savefig.dpi": 300, "font.size": 10,
                     "axes.grid": True, "grid.alpha": 0.3,
                     "axes.spines.top": False, "axes.spines.right": False})

BASE = Path(__file__).parent
dirs = sorted((BASE / "results").glob("aptos_cv_*"))
EXP = dirs[-1] if len(sys.argv) < 2 else BASE / "results" / sys.argv[1]
OUT = EXP / "plots"; OUT.mkdir(exist_ok=True)
data = json.loads((EXP / "cv_full.json").read_text())
folds = data["folds"]
tau = data["tau_stability"]
LESION = [1, 3, 4, 5]
NAMES = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}

# 1) Boxplot por regla, métricas
rule_names = list(folds[0]["rules"].keys())
metrics_to_show = ["sensitivity", "specificity", "mcc", "youden_j"]
fig, axes = plt.subplots(2, 2, figsize=(12, 8))
for ax, met in zip(axes.flat, metrics_to_show):
    arr = [[f["rules"][rn][met] for f in folds] for rn in rule_names]
    bp = ax.boxplot(arr, labels=rule_names, patch_artist=True, showmeans=True,
                    meanprops=dict(marker="D", markerfacecolor="red", markersize=6))
    for patch in bp["boxes"]:
        patch.set_facecolor("#dbeafe"); patch.set_edgecolor("#2563eb")
    ax.set_title(met.upper())
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right", fontsize=8)
    ax.set_ylim(0.4, 1.02)
fig.suptitle("Distribución por fold (5-fold CV) — APTOS")
fig.tight_layout(); fig.savefig(OUT / "01_metrics_boxplot.png"); plt.close(fig)

# 2) Estabilidad τ
fig, ax = plt.subplots(figsize=(8, 5))
methods = ["youden", "fpr10", "fpr05", "fpr02"]
x = np.arange(len(LESION)); w = 0.2
colors = {"youden": "#2563eb", "fpr10": "#16a34a",
          "fpr05": "#f59e0b", "fpr02": "#dc2626"}
for i, m in enumerate(methods):
    means = [tau[m][str(c)]["mean"] for c in LESION]
    stds = [tau[m][str(c)]["std"] for c in LESION]
    ax.bar(x + (i - 1.5) * w, means, w, yerr=stds, label=m,
           color=colors[m], capsize=3, edgecolor="black", linewidth=0.4)
ax.set_xticks(x); ax.set_xticklabels([f"c{c}\n{NAMES[c]}" for c in LESION])
ax.set_ylabel("τ")
ax.set_title("Estabilidad de umbrales per-clase a través de folds (mean ± std)")
ax.legend(title="método")
fig.tight_layout(); fig.savefig(OUT / "02_tau_stability.png"); plt.close(fig)

# 3) Sens vs Spec scatter por fold para PCT_fpr02
fig, ax = plt.subplots(figsize=(6, 5.5))
for f in folds:
    r = f["rules"]["PCT_fpr02"]
    ax.scatter(1 - r["specificity"], r["sensitivity"], s=120,
               color="#dc2626", edgecolor="black", zorder=3,
               label=f"fold {f['fold']}")
    ax.annotate(f"f{f['fold']}", (1 - r["specificity"], r["sensitivity"]),
                fontsize=9, xytext=(5, 5), textcoords="offset points")
mean_s = np.mean([f["rules"]["PCT_fpr02"]["sensitivity"] for f in folds])
mean_sp = np.mean([f["rules"]["PCT_fpr02"]["specificity"] for f in folds])
ax.scatter(1 - mean_sp, mean_s, s=200, marker="*", color="gold",
           edgecolor="black", zorder=4, label=f"media (sens={mean_s:.3f}, spec={mean_sp:.3f})")
ax.set_xlabel("1 − Especificidad"); ax.set_ylabel("Sensibilidad")
ax.set_title("PCT_fpr02 — variabilidad por fold (5-fold CV)")
ax.legend(loc="lower right", fontsize=8)
ax.set_xlim(0.04, 0.10); ax.set_ylim(0.93, 1.0)
fig.tight_layout(); fig.savefig(OUT / "03_pct_fpr02_per_fold.png"); plt.close(fig)

print(f"[OK] {len(list(OUT.glob('*.png')))} gráficos en {OUT}")
