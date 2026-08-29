# LocalManager web

Interfaccia React/Vite della simulazione. In sviluppo, Vite inoltra `/api/*` al
server su `localhost:3001`.

La mappa ospite usa `public/maps/smi-basemap.png` e disegna gli interventi
completati come cerchi SVG lato client. Per una partita autenticata, la chiusura
di un mese con overlay modificato salva lo stato, avvia un map job e sostituisce
la base locale con il PNG prodotto dall'API quando è pronto.
