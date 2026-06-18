#!/usr/bin/env python3
"""Gráficos del experimento per-class."""
import json, sys
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl
from sklearn.metrics import roc_curve, roc_auc_score

mpl.rcParams.update({"figure.dpi": 110, "savefig.dpi": 300, "font.size": 10,
                     "axes.grid": True, "grid.alpha": 0.3,
                     "axes.spines.top": False, "axes.spines.right": False})

BASE = Path(__file__).parent
# Detectar último dir aptos_perclass_*
dirs = sorted((BASE / "results").glob("aptos_perclass_*"))
EXP = dirs[-1] if not (len(sys.argv) > 1) else BASE / "results" / sys.argv[1]
OUT = EXP / "plots"; OUT.mkdir(exist_ok=True)
print(f"[*] Exp: {EXP}")

cal = json.loads((EXP / "perclass_calibration.json").read_text())
rules = json.loads((EXP / "rules_full.json").read_text())
summary = pd.read_csv(EXP / "rules_summary.csv")

# Reconstruyo pivot de scores per-class para ROC plots
SWEEP = BASE / "results" / "aptos_sweep_20260430_140753"
raw = pd.read_csv(SWEEP / "raw_detections.csv")
gt = pd.read_csv(BASE / "aptos_extracted" / "train.csv")
gt = gt.rename(columns={"diagnosis": "gt_grade"})
gt["gt_binary"] = (gt["gt_grade"] != 0).astype(int)
LESION = [1, 3, 4, 5]
NAMES = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}
COLORS = {1: "#f59e0b", 3: "#ef4444", 4: "#a855f7", 5: "#ec4899"}

pivot = (raw[raw["class"] >= 0]
         .groupby(["id_code", "class"])["score"].max().unstack(fill_value=0.0))
for c in LESION:
    if c not in pivot.columns:
        pivot[c] = 0.0
pivot = pivot[LESION].reset_index()
df = gt.merge(pivot, on="id_code", how="left").fillna(0.0)


# 1) ROC per-class
fig, ax = plt.subplots(figsize=(6.5, 6))
for c in LESION:
    fpr, tpr, _ = roc_curve(df["gt_binary"], df[c])
    auc = roc_auc_score(df["gt_binary"], df[c])
    ax.plot(fpr, tpr, lw=2, color=COLORS[c],
            label=f"c{c} {NAMES[c]} (AUC={auc:.3f})")
    # marcar τ_fpr02 y τ_youden
    cal_c = cal[str(c)]
    for tag, tau, marker in [("fpr02", cal_c["tau_fpr02"], "o"),
                              ("youden", cal_c["tau_youden"], "s")]:
        idx = np.argmin(np.abs(np.unique(df[c].values)[::-1] - tau)) if False else None
        scores = df[c].values
        pred = (scores >= tau).astype(int)
        tp = ((pred == 1) & (df["gt_binary"] == 1)).sum()
        fp = ((pred == 1) & (df["gt_binary"] == 0)).sum()
        fn = ((pred == 0) & (df["gt_binary"] == 1)).sum()
        tn = ((pred == 0) & (df["gt_binary"] == 0)).sum()
        s = tp / (tp + fn); p = 1 - tn / (tn + fp)
        ax.scatter(p, s, color=COLORS[c], marker=marker, s=70,
                   edgecolor="black", zorder=5)
ax.plot([0, 1], [0, 1], "--", color="gray", lw=1)
ax.set_xlabel("FPR (1 − Especificidad)"); ax.set_ylabel("TPR (Sensibilidad)")
ax.set_title("ROC por clase de lesión — score máx por imagen")
ax.legend(loc="lower right", fontsize=9)
fig.tight_layout(); fig.savefig(OUT / "01_roc_per_class.png"); plt.close(fig)

# 2) Histogramas de score máximo por clase: normales vs patológicos
fig, axes = plt.subplots(2, 2, figsize=(11, 8))
for ax, c in zip(axes.flat, LESION):
    n_scores = df[df["gt_binary"] == 0][c]
    p_scores = df[df["gt_binary"] == 1][c]
    bins = np.linspace(0, 1, 41)
    ax.hist(n_scores[n_scores > 0], bins=bins, alpha=0.6,
            color="#10b981", label=f"normal (n={(n_scores>0).sum()})",
            edgecolor="white")
    ax.hist(p_scores[p_scores > 0], bins=bins, alpha=0.6,
            color="#ef4444", label=f"patológico (n={(p_scores>0).sum()})",
            edgecolor="white")
    cal_c = cal[str(c)]
    ax.axvline(cal_c["tau_youden"], ls="--", color="black", lw=1,
               label=f"τ_youden={cal_c['tau_youden']:.3f}")
    ax.axvline(cal_c["tau_fpr02"], ls=":", color="#7c3aed", lw=1.5,
               label=f"τ_fpr02={cal_c['tau_fpr02']:.3f}")
    ax.set_title(f"c{c} {NAMES[c]} — AUC={cal_c['auc_per_class']:.3f}")
    ax.set_xlabel("score máx por imagen"); ax.legend(fontsize=8)
fig.suptitle("Distribución de score máximo por clase (solo imágenes con detección)")
fig.tight_layout(); fig.savefig(OUT / "02_score_dist_per_class.png"); plt.close(fig)

# 3) Comparación de reglas: barras agrupadas
fig, ax = plt.subplots(figsize=(13, 5.5))
x = np.arange(len(summary))
w = 0.18
ax.bar(x - 1.5*w, summary["sensitivity"], w, label="Sens", color="#dc2626")
ax.bar(x - 0.5*w, summary["specificity"], w, label="Spec", color="#16a34a")
ax.bar(x + 0.5*w, summary["mcc"], w, label="MCC", color="#7c3aed")
ax.bar(x + 1.5*w, summary["youden_j"], w, label="Youden J", color="#2563eb")
ax.set_xticks(x); ax.set_xticklabels(summary["rule"], rotation=30, ha="right",
                                     fontsize=8)
ax.set_ylim(0, 1.05); ax.set_ylabel("Métrica")
ax.set_title("Reglas — Sens / Spec / MCC / Youden J")
ax.legend(ncol=4)
# Resaltar el ganador (máx MCC)
best_i = int(summary["mcc"].idxmax())
for spine in ["bottom", "left"]: ax.spines[spine].set_visible(True)
ax.axvspan(best_i - 0.5, best_i + 0.5, alpha=0.12, color="gold")
fig.tight_layout(); fig.savefig(OUT / "03_rules_comparison.png"); plt.close(fig)

# 4) Sens-Spec scatter
fig, ax = plt.subplots(figsize=(7.5, 6))
fams = {"UNI": "#94a3b8", "PCT": "#2563eb", "HYBRID": "#dc2626"}
for _, r in summary.iterrows():
    fam = r["rule"].split("_")[0]
    ax.scatter(1 - r["specificity"], r["sensitivity"], s=110,
               color=fams.get(fam, "gray"), edgecolor="black", zorder=3)
    ax.annotate(r["rule"], (1 - r["specificity"], r["sensitivity"]),
                fontsize=7, xytext=(5, 4), textcoords="offset points")
ax.plot([0, 1], [0, 1], "--", color="gray", lw=0.7, alpha=0.5)
ax.set_xlabel("1 − Especificidad"); ax.set_ylabel("Sensibilidad")
ax.set_title("Trade-off sens/spec por regla — calibración per-clase")
ax.set_xlim(-0.02, 0.6); ax.set_ylim(0.7, 1.02)
handles = [plt.Line2D([0], [0], marker="o", color="w",
                       markerfacecolor=c, markersize=10, label=k)
           for k, c in fams.items()]
ax.legend(handles=handles, title="Familia")
fig.tight_layout(); fig.savefig(OUT / "04_sens_spec_scatter.png"); plt.close(fig)

# 5) Heatmap per-grade
grades = ["0", "1", "2", "3", "4"]
mat = np.zeros((len(rules), len(grades)))
labels = []
for i, r in enumerate(rules):
    labels.append(r["rule"])
    for j, g in enumerate(grades):
        d = r["per_grade"].get(g, {})
        mat[i, j] = d.get("sensitivity", d.get("specificity", np.nan))
fig, ax = plt.subplots(figsize=(8, 6))
im = ax.imshow(mat, cmap="RdYlGn", vmin=0.5, vmax=1, aspect="auto")
ax.set_xticks(range(5))
ax.set_xticklabels([f"g{g}\n({'spec' if g=='0' else 'sens'})" for g in grades])
ax.set_yticks(range(len(rules))); ax.set_yticklabels(labels, fontsize=9)
for i in range(len(rules)):
    for j in range(5):
        ax.text(j, i, f"{mat[i,j]:.3f}", ha="center", va="center", fontsize=8)
ax.set_title("Desempeño por grado APTOS — reglas calibradas")
plt.colorbar(im, ax=ax, fraction=0.04); ax.grid(False)
fig.tight_layout(); fig.savefig(OUT / "05_per_grade_heatmap.png"); plt.close(fig)

# 6) Tabla visual de τ recomendados
fig, ax = plt.subplots(figsize=(8, 4))
ax.axis("off")
tau_rows = [["clase", "AUC", "τ_youden", "τ_fpr10", "τ_fpr05", "τ_fpr02",
             "FP@0.25 (normales)", "TP@0.25 (patol.)"]]
for c in LESION:
    d = cal[str(c)]
    tau_rows.append([f"c{c} {NAMES[c]}",
                     f"{d['auc_per_class']:.3f}",
                     f"{d['tau_youden']:.3f}",
                     f"{d['tau_fpr10']:.3f}",
                     f"{d['tau_fpr05']:.3f}",
                     f"{d['tau_fpr02']:.3f}",
                     str(d["n_normals_with_det"]),
                     str(d["n_pathol_with_det"])])
tab = ax.table(cellText=tau_rows, loc="center", cellLoc="center",
               colWidths=[0.18] + [0.10] * 7)
tab.auto_set_font_size(False); tab.set_fontsize(9); tab.scale(1, 1.6)
for j in range(8): tab.get_celld()[(0, j)].set_facecolor("#dbeafe")
ax.set_title("Calibración per-clase — umbrales recomendados", pad=10)
fig.tight_layout(); fig.savefig(OUT / "06_threshold_table.png"); plt.close(fig)

print(f"[OK] {len(list(OUT.glob('*.png')))} gráficos en {OUT}")
