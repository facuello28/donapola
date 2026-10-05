/**
 * Precios del emprendimiento. Calcula siempre la combinación más barata
 * entre unidad, pack de 2 y bandeja de 6.
 */
export class ListaPrecios {
    constructor({ unidad = 80, par = 150, bandeja = 390, brochette = 90 } = {}) {
        this.unidad = unidad;       // 1 dona
        this.par = par;             // pack de 2 donas
        this.bandeja = bandeja;     // bandeja de 6 donas
        this.brochette = brochette; // 1 brochette (x3 mini donas)
    }

    /** Costo mínimo para `cantidad` donas (programación dinámica). */
    costoDonas(cantidad) {
        const mejor = [0];
        for (let i = 1; i <= cantidad; i++) {
            let costo = mejor[i - 1] + this.unidad;
            if (i >= 2) costo = Math.min(costo, mejor[i - 2] + this.par);
            if (i >= 6) costo = Math.min(costo, mejor[i - 6] + this.bandeja);
            mejor[i] = costo;
        }
        return mejor[cantidad];
    }
}
