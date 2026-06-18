#!/usr/bin/env python3
"""Gráficos faltantes: Exp 5, Exp 6, master comparativa."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib as mpl

mpl.rcParams.update({"figure.dpi": 110, "savefig.dpi": 300, "font.size": 10,
                     "axes.grid": True, "grid.alpha": 0.3,
                     "axes.spines.top": False, "axes.spines.right": False})

BASE = Path(__file__).parent
RES = BASE / "results"

EXP5 = sorted(RES.glob("aptos_area_filter_*"))[-1]
EXP6 = sorted(RES.glob("aptos_area_perclass_*"))[-1]
OUT5 = EXP5 / "plots"; OUT5.mkdir(exist_ok=True)
OUT6 = EXP6 / "plots"; OUT6.mkdir(exist_ok=True)
MASTER = RES / "master_plots"; MASTER.mkdir(exist_ok=True)


# ============================================================
# Exp 5 — filtro de área
# ============================================================
def plot_exp5():
    s5 = pd.read_csv(EXP5 / "area_filter_summary.csv")

    # 1) curvas: para cada regla, métricas vs MIN_AREA
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.5))
    for ax, met, title in zip(axes, ["sensitivity", "specificity", "mcc"],
                               ["Sensibilidad", "Especificidad", "MCC"]):
        for rule, sub in s5.groupby("rule"):
            sub = sub.sort_values("min_area_px")
            ax.plot(sub["min_area_px"], sub[met], "o-", lw=2, label=rule)
        ax.set_xlabel("MIN_AREA (px)"); ax.set_ylabel(met); ax.set_title(title)
        ax.set_xscale("symlog", linthresh=50)
        ax.set_xticks([0, 50, 100, 200, 400, 800])
        ax.set_xticklabels(["0", "50", "100", "200", "400", "800"])
    axes[0].legend(fontsize=8, loc="lower right")
    fig.suptitle("Exp 5 — métricas vs filtro de área")
    fig.tight_layout(); fig.savefig(OUT5 / "01_metrics_vs_area.png"); plt.close(fig)

    # 2) Sens vs Spec scatter
    fig, ax = plt.subplots(figsize=(7, 6))
    rules = list(s5["rule"].unique())
    cmap = plt.cm.tab10
    for i, rule in enumerate(rules):
        sub = s5[s5["rule"] == rule].sort_values("min_area_px")
        ax.plot(1 - sub["specificity"], sub["sensitivity"], "o-",
                color=cmap(i), lw=2, label=rule)
        for _, r in sub.iterrows():
            ax.annotate(f"{int(r['min_area_px'])}",
                        (1 - r["specificity"], r["sensitivity"]),
                        fontsize=7, xytext=(4, 3), textcoords="offset points")
    ax.plot([0, 1], [0, 1], "--", color="gray", lw=0.7, alpha=0.5)
    ax.set_xlabel("1 − Especificidad"); ax.set_ylabel("Sensibilidad")
    ax.set_title("Exp 5 — trayectoria sens/spec por filtro de área")
    ax.legend(fontsize=8); ax.set_xlim(-0.02, 0.6); ax.set_ylim(0.85, 1.01)
    fig.tight_layout(); fig.savefig(OUT5 / "02_sens_spec_paths.png"); plt.close(fig)

    # 3) Eliminaciones por clase y área (necesita reconstruir desde cache)
    cache = RES / "raw_detections_bbox.csv"
    det = pd.read_csv(cache)
    det["area_px"] = ((det["x2"] - det["x1"]).clip(lower=0)
                      * (det["y2"] - det["y1"]).clip(lower=0))
    LESION = [1, 3, 4, 5]
    NAMES = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot",
             5: "microhemorrhages"}
    AREAS = [0, 50, 100, 200, 400, 800, 1200]
    elim_pct = []
    for c in LESION:
        sub = det[det["class_idx"] == c]
        total = len(sub)
        row = {"clase": NAMES[c]}
        for a in AREAS:
            kept = (sub["area_px"] >= a).sum()
            row[a] = (1 - kept / total) * 100 if total else 0
        elim_pct.append(row)
    elim_df = pd.DataFrame(elim_pct).set_index("clase")

    fig, ax = plt.subplots(figsize=(9, 4.5))
    elim_df[AREAS].T.plot(kind="bar", ax=ax, width=0.85, edgecolor="black",
                          linewidth=0.4, colormap="tab10")
    ax.set_xlabel("MIN_AREA (px)"); ax.set_ylabel("% detecciones eliminadas")
    ax.set_title("Exp 5 — porcentaje eliminado por filtro de área (por clase)")
    ax.legend(title="clase", fontsize=8)
    plt.setp(ax.get_xticklabels(), rotation=0)
    fig.tight_layout(); fig.savefig(OUT5 / "03_elimination_per_class.png"); plt.close(fig)

    # 4) histograma area_px por clase de lesión, normales vs patológicos
    gt = (det.groupby("image_id")["gt_grade"].first().reset_index())
    gt["gt_binary"] = (gt["gt_grade"] != 0).astype(int)
    det = det.merge(gt[["image_id", "gt_binary"]], on="image_id")
    fig, axes = plt.subplots(2, 2, figsize=(11, 7))
    for ax, c in zip(axes.flat, LESION):
        sub = det[det["class_idx"] == c]
        n = sub[sub["gt_binary"] == 0]["area_px"]
        p = sub[sub["gt_binary"] == 1]["area_px"]
        bins = np.logspace(0, 5.5, 50)
        ax.hist(n, bins=bins, alpha=0.6, color="#10b981",
                label=f"normal n={len(n)}", edgecolor="white")
        ax.hist(p, bins=bins, alpha=0.6, color="#ef4444",
                label=f"patol n={len(p)}", edgecolor="white")
        ax.set_xscale("log"); ax.set_title(f"c{c} {NAMES[c]}")
        ax.set_xlabel("area_px (log)"); ax.legend(fontsize=8)
        for thr, col in [(200, "#7c3aed"), (800, "#f59e0b")]:
            ax.axvline(thr, ls="--", color=col, lw=1)
    fig.suptitle("Exp 5 — distribución de área por clase, normales vs patológicos")
    fig.tight_layout(); fig.savefig(OUT5 / "04_area_distribution.png"); plt.close(fig)

    print(f"[OK] Exp5: {len(list(OUT5.glob('*.png')))} gráficos")


# ============================================================
# Exp 6 — área × per-class
# ============================================================
def plot_exp6():
    s6 = pd.read_csv(EXP6 / "summary.csv")
    cal = json.loads((EXP6 / "calibrations.json").read_text())

    # 1) Heatmap MCC por (MIN_AREA × regla)
    pivot = s6.pivot(index="rule", columns="min_area_px", values="mcc")
    fig, ax = plt.subplots(figsize=(8, 5))
    im = ax.imshow(pivot.values, cmap="RdYlGn", vmin=0.7, vmax=0.95, aspect="auto")
    ax.set_xticks(range(len(pivot.columns)))
    ax.set_xticklabels(pivot.columns)
    ax.set_yticks(range(len(pivot.index))); ax.set_yticklabels(pivot.index)
    for i in range(len(pivot.index)):
        for j in range(len(pivot.columns)):
            ax.text(j, i, f"{pivot.values[i,j]:.3f}", ha="center", va="center",
                    fontsize=9)
    ax.set_xlabel("MIN_AREA (px)"); ax.set_title("Exp 6 — MCC por (MIN_AREA × regla)")
    plt.colorbar(im, ax=ax, fraction=0.04); ax.grid(False)
    fig.tight_layout(); fig.savefig(OUT6 / "01_mcc_heatmap.png"); plt.close(fig)

    # 2) Sens vs Spec scatter
    fig, ax = plt.subplots(figsize=(7, 6))
    cmap = plt.cm.tab10
    rules = list(s6["rule"].unique())
    for i, rule in enumerate(rules):
        sub = s6[s6["rule"] == rule].sort_values("min_area_px")
        ax.plot(1 - sub["specificity"], sub["sensitivity"], "o-",
                color=cmap(i), lw=2, label=rule)
        for _, r in sub.iterrows():
            ax.annotate(f"{int(r['min_area_px'])}",
                        (1 - r["specificity"], r["sensitivity"]),
                        fontsize=7, xytext=(4, 3), textcoords="offset points")
    ax.set_xlabel("1 − Especificidad"); ax.set_ylabel("Sensibilidad")
    ax.set_title("Exp 6 — trayectorias sens/spec (área × per-class)")
    ax.legend(fontsize=8, loc="lower right")
    ax.set_xlim(-0.02, 0.35); ax.set_ylim(0.7, 1.02)
    fig.tight_layout(); fig.savefig(OUT6 / "02_sens_spec_paths.png"); plt.close(fig)

    # 3) AUC interno por clase vs MIN_AREA
    LESION = [1, 3, 4, 5]
    NAMES = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot",
             5: "microhemorrhages"}
    COLORS = {1: "#f59e0b", 3: "#ef4444", 4: "#a855f7", 5: "#ec4899"}
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.5))
    areas = sorted(int(a) for a in cal.keys())
    for c in LESION:
        aucs = [cal[str(a)][str(c)]["auc"] for a in areas]
        taus = [cal[str(a)][str(c)]["tau_fpr02"] for a in areas]
        axes[0].plot(areas, aucs, "o-", color=COLORS[c], lw=2, label=NAMES[c])
        axes[1].plot(areas, taus, "o-", color=COLORS[c], lw=2, label=NAMES[c])
    axes[0].set_xlabel("MIN_AREA (px)"); axes[0].set_ylabel("AUC interno")
    axes[0].set_title("AUC por clase vs filtro de área"); axes[0].legend(fontsize=8)
    axes[1].set_xlabel("MIN_AREA (px)"); axes[1].set_ylabel("τ_fpr02 calibrado")
    axes[1].set_title("Umbral recalibrado vs filtro de área"); axes[1].legend(fontsize=8)
    fig.tight_layout(); fig.savefig(OUT6 / "03_auc_tau_vs_area.png"); plt.close(fig)

    print(f"[OK] Exp6: {len(list(OUT6.glob('*.png')))} gráficos")


# ============================================================
# Master — comparativa de mejores puntos
# ============================================================
def plot_master():
    points = [
        ("Exp1\nUNI 0.25",        0.9968, 0.4565, 0.5413, 0.4533, "#94a3b8"),
        ("Exp2\nR3 (uniforme)",   0.9316, 0.9180, 0.8498, 0.8496, "#2563eb"),
        ("Exp3\nPCT_fpr02",       0.9785, 0.9330, 0.9129, 0.9114, "#dc2626"),
        ("Exp4\nCV mean",         0.9779, 0.9313, 0.9108, 0.9092, "#9333ea"),
        ("Exp5\narea=800 + R3",   0.9246, 0.9540, 0.8787, 0.8786, "#16a34a"),
        ("Exp6\nPCT_fpr02 + a=1200", 0.9790, 0.9324, 0.9129, 0.9114, "#f59e0b"),
    ]
    labels, sens, spec, mcc, j, colors = zip(*points)

    # 1) ROC space — dos paneles lado a lado (vista global + zoom cluster)
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(14, 6.5),
                                   gridspec_kw={"width_ratios": [1, 1]})

    # Panel izquierdo — vista global
    ax.plot([0, 1], [0, 1], "--", color="gray", lw=0.7, alpha=0.5)
    for jval, alpha in [(0.4, 0.18), (0.6, 0.22), (0.8, 0.26), (0.9, 0.32)]:
        xs = np.linspace(0, 1 - jval, 100)
        ax.plot(xs, xs + jval, "-", color="black", alpha=alpha, lw=0.7)
        ax.text(0.005, jval + 0.005, f"J={jval}", fontsize=8,
                color="black", alpha=alpha + 0.3)
    for lab, s, sp, m, jj, c in points:
        ax.scatter(1 - sp, s, s=200, color=c, edgecolor="black",
                   linewidth=1.2, zorder=4)
    ax.annotate(points[0][0], (1 - points[0][2], points[0][1]),
                fontsize=10, xytext=(10, -3), textcoords="offset points",
                fontweight="bold")
    # Recuadro indicando zona de zoom
    from matplotlib.patches import Rectangle
    ax.add_patch(Rectangle((0.04, 0.91), 0.06, 0.08, fill=False,
                           edgecolor="#2563eb", lw=1.5, ls="--", zorder=5))
    ax.annotate("zoom →", xy=(0.10, 0.95), xytext=(0.18, 0.85),
                fontsize=9, color="#2563eb", fontweight="bold",
                arrowprops=dict(arrowstyle="->", color="#2563eb"))
    ax.set_xlabel("1 − Especificidad (FPR)")
    ax.set_ylabel("Sensibilidad (TPR)")
    ax.set_title("Vista global — los 6 puntos")
    ax.set_xlim(-0.02, 0.65); ax.set_ylim(0.4, 1.02)

    # Panel derecho — zoom cluster Exp2-6
    for jval, alpha in [(0.85, 0.20), (0.88, 0.25), (0.90, 0.30), (0.91, 0.32)]:
        xs = np.linspace(0, 1 - jval, 100)
        ax2.plot(xs, xs + jval, "-", color="black", alpha=alpha, lw=0.7)
        ax2.text(0.041, jval + 0.041 + 0.001, f"J={jval}", fontsize=7,
                 color="black", alpha=alpha + 0.3)
    for lab, s, sp, m, jj, c in points[1:]:
        ax2.scatter(1 - sp, s, s=220, color=c, edgecolor="black",
                    linewidth=1.2, zorder=4)
        ax2.annotate(lab, (1 - sp, s), fontsize=9, xytext=(8, 5),
                     textcoords="offset points")
    ax2.set_xlabel("1 − Especificidad (FPR)")
    ax2.set_ylabel("Sensibilidad (TPR)")
    ax2.set_title("Zoom — Exp 2 a 6 (cluster)")
    ax2.set_xlim(0.04, 0.10); ax2.set_ylim(0.91, 0.99)
    for spine in ax2.spines.values():
        spine.set_edgecolor("#2563eb"); spine.set_linewidth(1.5)

    fig.suptitle("Mejores puntos de cada experimento — espacio ROC", y=1.00)
    fig.tight_layout(); fig.savefig(MASTER / "01_master_roc.png"); plt.close(fig)

    # 2) Bar chart con sens, spec, MCC, J
    x = np.arange(len(points)); w = 0.2
    fig, ax = plt.subplots(figsize=(11, 5.5))
    ax.bar(x - 1.5*w, sens, w, label="Sens", color="#dc2626")
    ax.bar(x - 0.5*w, spec, w, label="Spec", color="#16a34a")
    ax.bar(x + 0.5*w, mcc,  w, label="MCC",  color="#7c3aed")
    ax.bar(x + 1.5*w, j,    w, label="Youden J", color="#2563eb")
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=8)
    ax.set_ylim(0, 1.05); ax.set_ylabel("Valor")
    ax.set_title("Comparativa de mejores puntos por experimento")
    ax.legend(ncol=4, loc="lower right")
    # marcar el ganador (max MCC)
    best_idx = int(np.argmax(mcc))
    ax.axvspan(best_idx - 0.5, best_idx + 0.5, color="gold", alpha=0.15)
    for i, m in enumerate(mcc):
        ax.text(i + 0.5*w, m + 0.01, f"{m:.3f}", fontsize=7, ha="center",
                color="#7c3aed", fontweight="bold")
    fig.tight_layout(); fig.savefig(MASTER / "02_master_bars.png"); plt.close(fig)

    # 3) Tabla de progresión MCC
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(range(len(points)), mcc, "o-", lw=3, color="#7c3aed", markersize=11)
    for i, (lab, _, _, m, _, _) in enumerate(points):
        ax.text(i, m + 0.012, f"{m:.3f}", ha="center", fontsize=10,
                fontweight="bold")
        ax.text(i, m - 0.045, lab, ha="center", fontsize=8)
    ax.set_xticks(range(len(points))); ax.set_xticklabels([])
    ax.set_ylim(0.45, 0.97); ax.set_ylabel("MCC")
    ax.set_title("Progresión del MCC a través de los 6 experimentos")
    ax.axhline(0.91, ls="--", color="green", alpha=0.5,
               label="Punto operativo recomendado (0.913)")
    ax.legend()
    fig.tight_layout(); fig.savefig(MASTER / "03_mcc_progression.png"); plt.close(fig)

    print(f"[OK] Master: {len(list(MASTER.glob('*.png')))} gráficos")


if __name__ == "__main__":
    plot_exp5()
    plot_exp6()
    plot_master()
