#!/usr/bin/env python3
"""Genera gráficos PNG (300dpi) para ambos experimentos APTOS."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl

mpl.rcParams.update({
    "figure.dpi": 110,
    "savefig.dpi": 300,
    "font.size": 10,
    "axes.grid": True,
    "grid.alpha": 0.3,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

BASE = Path(__file__).parent / "results"
EXP1 = BASE / "aptos_binary_20260430_135006"
EXP2 = BASE / "aptos_sweep_20260430_140753"
OUT1 = EXP1 / "plots"; OUT1.mkdir(exist_ok=True)
OUT2 = EXP2 / "plots"; OUT2.mkdir(exist_ok=True)


# ============================================================
# EXP 1 — corrida fija conf=0.25
# ============================================================
def plot_exp1():
    metrics = json.loads((EXP1 / "metrics.json").read_text())
    roc = json.loads((EXP1 / "roc_curve.json").read_text())
    per_img = pd.read_csv(EXP1 / "per_image.csv")

    # 1) Confusion matrix
    cm = np.array(metrics["confusion_matrix"]["matrix"])
    fig, ax = plt.subplots(figsize=(5, 4.5))
    im = ax.imshow(cm, cmap="Blues")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f"{cm[i,j]}", ha="center", va="center",
                    fontsize=14, fontweight="bold",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
    ax.set_xticklabels(["Normal\n(pred)", "Alterado\n(pred)"])
    ax.set_yticklabels(["Normal\n(GT)", "Alterado\n(GT)"])
    ax.set_title("Matriz de confusión — APTOS (conf≥0.25)")
    plt.colorbar(im, ax=ax, fraction=0.046)
    ax.grid(False)
    fig.tight_layout(); fig.savefig(OUT1 / "01_confusion_matrix.png"); plt.close(fig)

    # 2) ROC curve
    fpr, tpr = np.array(roc["fpr"]), np.array(roc["tpr"])
    auc = metrics["metrics"]["auc_roc"]
    fig, ax = plt.subplots(figsize=(5.5, 5))
    ax.plot(fpr, tpr, lw=2, color="#2563eb", label=f"DIRD+ v2 (AUC = {auc:.4f})")
    ax.plot([0, 1], [0, 1], "--", color="gray", lw=1, label="azar")
    op_sens = metrics["metrics"]["sensitivity_recall"]
    op_spec = metrics["metrics"]["specificity"]
    ax.scatter([1 - op_spec], [op_sens], color="#dc2626", s=80, zorder=5,
               label=f"conf=0.25 (sens={op_sens:.3f}, spec={op_spec:.3f})")
    ax.set_xlabel("1 − Especificidad (FPR)"); ax.set_ylabel("Sensibilidad (TPR)")
    ax.set_title("Curva ROC — clasificación binaria")
    ax.legend(loc="lower right"); ax.set_xlim(-0.01, 1.01); ax.set_ylim(-0.01, 1.01)
    fig.tight_layout(); fig.savefig(OUT1 / "02_roc_curve.png"); plt.close(fig)

    # 3) Sens / Spec por grado APTOS
    pg = metrics["per_grade"]
    grades, vals, kinds = [], [], []
    for g, d in pg.items():
        grades.append(int(g))
        if "sensitivity_detected" in d:
            vals.append(d["sensitivity_detected"]); kinds.append("Sens")
        else:
            vals.append(d["specificity_correct_normal"]); kinds.append("Spec")
    colors = ["#10b981" if k == "Spec" else "#ef4444" for k in kinds]
    fig, ax = plt.subplots(figsize=(7, 4.5))
    bars = ax.bar([f"g{g}\n(n={pg[str(g)]['n']})" for g in grades], vals,
                  color=colors, edgecolor="black", linewidth=0.5)
    for b, v, k in zip(bars, vals, kinds):
        ax.text(b.get_x() + b.get_width()/2, v + 0.01, f"{k}={v:.3f}",
                ha="center", fontsize=9)
    ax.set_ylim(0, 1.08); ax.set_ylabel("Sensibilidad / Especificidad")
    ax.set_title("Desempeño por grado APTOS  (verde = spec g0 / rojo = sens g1-4)")
    fig.tight_layout(); fig.savefig(OUT1 / "03_per_grade.png"); plt.close(fig)

    # 4) Histograma de tiempos
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.hist(per_img["infer_ms"], bins=60, color="#6366f1",
            edgecolor="white", alpha=0.85)
    t = metrics["timing_ms"]
    for label, v, c in [("mean", t["mean_ms"], "#dc2626"),
                       ("median", t["median_ms"], "#16a34a"),
                       ("p95", t["p95_ms"], "#f59e0b")]:
        ax.axvline(v, ls="--", color=c, lw=1.5, label=f"{label}={v:.1f}ms")
    ax.set_xlabel("Tiempo de inferencia (ms)"); ax.set_ylabel("Frecuencia")
    ax.set_title(f"Latencia por imagen (n={t['n']}, ≈{t['fps_mean']:.1f} FPS CPU)")
    ax.legend()
    fig.tight_layout(); fig.savefig(OUT1 / "04_timing_hist.png"); plt.close(fig)

    # 5) Distribución de score máximo de lesión por GT
    fig, ax = plt.subplots(figsize=(7, 4.5))
    for label, color in [(0, "#10b981"), (1, "#ef4444")]:
        sub = per_img[per_img["gt_binary"] == label]["max_lesion_score"]
        ax.hist(sub, bins=40, alpha=0.6, color=color,
                label=f"{'normal' if label==0 else 'alterado'} (n={len(sub)})",
                edgecolor="black", linewidth=0.3)
    ax.axvline(0.25, ls="--", color="black", lw=1, label="umbral=0.25")
    ax.set_xlabel("max lesion score"); ax.set_ylabel("Frecuencia")
    ax.set_title("Distribución del score máximo de lesión por clase real")
    ax.legend()
    fig.tight_layout(); fig.savefig(OUT1 / "05_score_distribution.png"); plt.close(fig)

    print(f"[OK] Exp1: {len(list(OUT1.glob('*.png')))} gráficos en {OUT1}")


# ============================================================
# EXP 2 — barrido
# ============================================================
def plot_exp2():
    full = json.loads((EXP2 / "rules_full.json").read_text())
    rules = full["rules"]
    timing = full["timing_ms"]
    raw = pd.read_csv(EXP2 / "raw_detections.csv")
    summary = pd.read_csv(EXP2 / "rules_summary.csv")

    # 1) Sens vs Spec scatter — todas las reglas
    fig, ax = plt.subplots(figsize=(7, 6))
    colors_map = {"R1": "#2563eb", "R2": "#16a34a", "R3": "#dc2626"}
    for r in rules:
        fam = r["rule"].split("_")[0]
        x, y = 1 - r["specificity"], r["sensitivity"]
        ax.scatter(x, y, color=colors_map[fam], s=80, edgecolor="black", zorder=3)
        short = r["rule"].replace("_conf>=", " c≥").replace("_n_lesions>=", " N≥") \
                         .replace("_any_lesion", "").replace(">=", "≥")
        ax.annotate(short, (x, y), fontsize=7, xytext=(5, 3),
                    textcoords="offset points")
    ax.plot([0, 1], [0, 1], "--", color="gray", lw=0.8, alpha=0.5)
    ax.set_xlabel("1 − Especificidad"); ax.set_ylabel("Sensibilidad")
    ax.set_title("Trade-off sens/spec por regla — APTOS sweep")
    ax.set_xlim(-0.02, 1); ax.set_ylim(0.6, 1.02)
    handles = [plt.Line2D([0], [0], marker="o", color="w",
                          markerfacecolor=c, markersize=10, label=k)
               for k, c in colors_map.items()]
    ax.legend(handles=handles, title="Familia")
    fig.tight_layout(); fig.savefig(OUT2 / "01_sens_spec_tradeoff.png"); plt.close(fig)

    # 2) Métricas R1 vs umbral conf
    r1 = [r for r in rules if r["rule"].startswith("R1_")]
    thrs = [float(r["rule"].split(">=")[-1]) for r in r1]
    fig, ax = plt.subplots(figsize=(8, 5))
    for key, color, label in [("sensitivity", "#dc2626", "Sensibilidad"),
                              ("specificity", "#16a34a", "Especificidad"),
                              ("ppv", "#f59e0b", "PPV"),
                              ("mcc", "#7c3aed", "MCC"),
                              ("youden_j", "#2563eb", "Youden J")]:
        ax.plot(thrs, [r[key] for r in r1], "o-", color=color, label=label, lw=2)
    ax.set_xlabel("Umbral de confianza (τ)"); ax.set_ylabel("Métrica")
    ax.set_title("R1 — métricas vs. umbral de confianza")
    ax.legend(loc="center right"); ax.set_ylim(0, 1.05)
    fig.tight_layout(); fig.savefig(OUT2 / "02_R1_metrics_vs_conf.png"); plt.close(fig)

    # 3) Métricas R2 vs N
    r2 = [r for r in rules if r["rule"].startswith("R2_")]
    ks = [int(r["rule"].split("_n_lesions>=")[1].split("_")[0]) for r in r2]
    fig, ax = plt.subplots(figsize=(8, 5))
    for key, color, label in [("sensitivity", "#dc2626", "Sensibilidad"),
                              ("specificity", "#16a34a", "Especificidad"),
                              ("ppv", "#f59e0b", "PPV"),
                              ("mcc", "#7c3aed", "MCC"),
                              ("youden_j", "#2563eb", "Youden J")]:
        ax.plot(ks, [r[key] for r in r2], "s-", color=color, label=label, lw=2)
    ax.set_xticks(ks)
    ax.set_xlabel("Mínimo nº de lesiones detectadas (K, conf≥0.25)")
    ax.set_ylabel("Métrica"); ax.set_title("R2 — métricas vs. K")
    ax.legend(loc="center right"); ax.set_ylim(0, 1.05)
    fig.tight_layout(); fig.savefig(OUT2 / "03_R2_metrics_vs_K.png"); plt.close(fig)

    # 4) Heatmap sens por grado × regla
    grades = ["0", "1", "2", "3", "4"]
    mat = np.zeros((len(rules), len(grades)))
    for i, r in enumerate(rules):
        for j, g in enumerate(grades):
            d = r["per_grade"].get(g, {})
            mat[i, j] = d.get("sensitivity", d.get("specificity", np.nan))
    short_names = [r["rule"]
                   .replace("R1_any_lesion_conf>=", "R1 c≥")
                   .replace("R2_n_lesions>=", "R2 N≥").replace("_conf>=0.25", "")
                   .replace("R3_conf>=0.40_and_n>=2", "R3 c≥0.40∧N≥2")
                   for r in rules]
    fig, ax = plt.subplots(figsize=(7, 7))
    im = ax.imshow(mat, cmap="RdYlGn", vmin=0.4, vmax=1, aspect="auto")
    ax.set_xticks(range(len(grades)))
    ax.set_xticklabels([f"g{g}\n({'spec' if g=='0' else 'sens'})" for g in grades])
    ax.set_yticks(range(len(rules))); ax.set_yticklabels(short_names, fontsize=8)
    for i in range(len(rules)):
        for j in range(len(grades)):
            ax.text(j, i, f"{mat[i,j]:.3f}", ha="center", va="center",
                    fontsize=8, color="black")
    ax.set_title("Desempeño por grado APTOS (g0=spec, g1-4=sens)")
    plt.colorbar(im, ax=ax, fraction=0.04)
    ax.grid(False)
    fig.tight_layout(); fig.savefig(OUT2 / "04_per_grade_heatmap.png"); plt.close(fig)

    # 5) Comparación de reglas — sens, spec, MCC, J
    fig, ax = plt.subplots(figsize=(11, 5.5))
    x = np.arange(len(summary))
    w = 0.2
    ax.bar(x - 1.5*w, summary["sensitivity"], w, label="Sens", color="#dc2626")
    ax.bar(x - 0.5*w, summary["specificity"], w, label="Spec", color="#16a34a")
    ax.bar(x + 0.5*w, summary["mcc"], w, label="MCC", color="#7c3aed")
    ax.bar(x + 1.5*w, summary["youden_j"], w, label="Youden J", color="#2563eb")
    ax.set_xticks(x)
    short = [r.replace("R1_any_lesion_conf>=", "R1 c≥")
              .replace("R2_n_lesions>=", "R2 N≥").replace("_conf>=0.25", "")
              .replace("R3_conf>=0.40_and_n>=2", "R3 c≥0.40\n∧N≥2")
            for r in summary["rule"]]
    ax.set_xticklabels(short, rotation=30, ha="right", fontsize=8)
    ax.set_ylabel("Valor"); ax.set_ylim(0, 1.05)
    ax.set_title("Comparación de reglas — Sens, Spec, MCC, J")
    ax.legend(ncol=4, loc="upper right")
    fig.tight_layout(); fig.savefig(OUT2 / "05_rules_comparison.png"); plt.close(fig)

    # 6) Score distribution lesion vs anatomical (raw)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    anat = raw[raw["class"].isin([0, 2])]["score"]
    les = raw[(~raw["class"].isin([-1, 0, 2]))]["score"]
    axes[0].hist(anat, bins=40, color="#10b981", alpha=0.8, edgecolor="white")
    axes[0].set_title(f"Detecciones anatómicas (clases 0,2) — n={len(anat)}")
    axes[0].set_xlabel("score")
    axes[1].hist(les, bins=40, color="#ef4444", alpha=0.8, edgecolor="white")
    for thr, c in [(0.25, "k"), (0.40, "#f59e0b"), (0.60, "#7c3aed")]:
        axes[1].axvline(thr, ls="--", color=c, lw=1.2, label=f"τ={thr}")
    axes[1].legend()
    axes[1].set_title(f"Detecciones de lesión (clases 1,3,4,5) — n={len(les)}")
    axes[1].set_xlabel("score")
    fig.suptitle("Distribución de scores en detecciones crudas")
    fig.tight_layout(); fig.savefig(OUT2 / "06_score_distribution_raw.png"); plt.close(fig)

    # 7) Frecuencia detecciones por clase
    class_names = {0: "optic_disc", 1: "hard_exudate", 2: "fovea",
                   3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}
    cnt = (raw[raw["score"] >= 0.25].groupby("class").size()
           .reindex(range(6), fill_value=0))
    fig, ax = plt.subplots(figsize=(8, 4.5))
    colors = ["#10b981", "#f59e0b", "#06b6d4", "#ef4444", "#a855f7", "#ec4899"]
    bars = ax.bar([class_names[i] for i in range(6)], cnt.values,
                  color=colors, edgecolor="black", linewidth=0.5)
    for b, v in zip(bars, cnt.values):
        ax.text(b.get_x() + b.get_width()/2, v + max(cnt.values)*0.01,
                f"{int(v)}", ha="center", fontsize=9)
    ax.set_ylabel("Detecciones (score ≥ 0.25)")
    ax.set_title("Total de detecciones por clase — APTOS n=3662")
    plt.setp(ax.get_xticklabels(), rotation=20, ha="right")
    fig.tight_layout(); fig.savefig(OUT2 / "07_detections_per_class.png"); plt.close(fig)

    # 8) Timing histogram (sweep)
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.axvline(timing["mean_ms"], ls="--", color="#dc2626", lw=1.5,
               label=f"mean={timing['mean_ms']:.1f}ms")
    ax.axvline(timing["median_ms"], ls="--", color="#16a34a", lw=1.5,
               label=f"median={timing['median_ms']:.1f}ms")
    ax.axvline(timing["p95_ms"], ls="--", color="#f59e0b", lw=1.5,
               label=f"p95={timing['p95_ms']:.1f}ms")
    ax.text(0.99, 0.95,
            f"min={timing['min_ms']:.1f}\nmax={timing['max_ms']:.1f}\nfps≈{timing['fps_mean']:.2f}",
            transform=ax.transAxes, ha="right", va="top",
            bbox=dict(boxstyle="round", fc="white", ec="gray"))
    # No tenemos vector de tiempos en sweep json; mostramos sólo barras de referencia
    ax.set_xlabel("Tiempo (ms)"); ax.set_yticks([])
    ax.set_title(f"Latencia sweep — n={timing['n']}, FPS≈{timing['fps_mean']:.2f}")
    ax.legend()
    fig.tight_layout(); fig.savefig(OUT2 / "08_timing_summary.png"); plt.close(fig)

    print(f"[OK] Exp2: {len(list(OUT2.glob('*.png')))} gráficos en {OUT2}")


if __name__ == "__main__":
    plot_exp1()
    plot_exp2()
