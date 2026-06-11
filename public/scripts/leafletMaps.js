// Wait for full page load including images
window.addEventListener('load', function() {
    console.log('Leaflet: window loaded, initializing maps');

    // Helper: parse coordinate from string/number
    function toNumber(val) {
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
    }

    // ---------- CREATE EVENT PAGE (interactive map) ----------
    const eventMapDiv = document.getElementById('event-map');
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');

    if (eventMapDiv && latInput && lngInput) {
        console.log('Leaflet: initializing create-event map');
        let lat = toNumber(latInput.value);
        let lng = toNumber(lngInput.value);
        const defaultCenter = [39.8283, -98.5795];
        const hasCoords = (lat !== null && lng !== null);

        const map = L.map(eventMapDiv).setView(
            hasCoords ? [lat, lng] : defaultCenter,
            hasCoords ? 12 : 4
        );
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const marker = L.marker(hasCoords ? [lat, lng] : defaultCenter, { draggable: true }).addTo(map);

        function updateInputs() {
            const pos = marker.getLatLng();
            latInput.value = pos.lat.toFixed(6);
            lngInput.value = pos.lng.toFixed(6);
        }
        function updateMarker() {
            const newLat = toNumber(latInput.value);
            const newLng = toNumber(lngInput.value);
            if (newLat !== null && newLng !== null) {
                marker.setLatLng([newLat, newLng]);
                map.setView([newLat, newLng], 12);
            }
        }

        map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            updateInputs();
        });
        marker.on('dragend', updateInputs);
        latInput.addEventListener('change', updateMarker);
        lngInput.addEventListener('change', updateMarker);

        // Force resize after a short delay (critical for maps inside Bootstrap columns)
        setTimeout(function() {
            map.invalidateSize();
            console.log('Leaflet: create-event map resized');
        }, 200);
    }

    // ---------- EVENT DETAIL PAGE (read-only map) ----------
    const detailMapDiv = document.getElementById('event-location-map');
    if (detailMapDiv) {
        const lat = toNumber(detailMapDiv.dataset.lat);
        const lng = toNumber(detailMapDiv.dataset.lng);
        if (lat !== null && lng !== null) {
            console.log('Leaflet: initializing event-detail map at', lat, lng);
            const map = L.map(detailMapDiv).setView([lat, lng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            L.marker([lat, lng]).addTo(map);
            setTimeout(function() {
                map.invalidateSize();
                console.log('Leaflet: event-detail map resized');
            }, 200);
        } else {
            console.warn('Leaflet: event-detail map missing valid lat/lng', detailMapDiv.dataset);
        }
    }

    // ---------- SEARCH PAGE (interactive map) ----------
    const searchMapDiv = document.getElementById('search-map');
    const searchLatInput = document.getElementById('location_lat');
    const searchLngInput = document.getElementById('location_lng');
    if (searchMapDiv && searchLatInput && searchLngInput) {
        console.log('Leaflet: initializing search map');
        let lat = toNumber(searchLatInput.value);
        let lng = toNumber(searchLngInput.value);
        const defaultCenter = [39.8283, -98.5795];
        const hasCoords = (lat !== null && lng !== null);
        const map = L.map(searchMapDiv).setView(
            hasCoords ? [lat, lng] : defaultCenter,
            hasCoords ? 12 : 4
        );
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        const marker = L.marker(hasCoords ? [lat, lng] : defaultCenter, { draggable: true }).addTo(map);
        function updateSearchInputs() {
            const pos = marker.getLatLng();
            searchLatInput.value = pos.lat.toFixed(6);
            searchLngInput.value = pos.lng.toFixed(6);
        }
        function updateSearchMarker() {
            const newLat = toNumber(searchLatInput.value);
            const newLng = toNumber(searchLngInput.value);
            if (newLat !== null && newLng !== null) {
                marker.setLatLng([newLat, newLng]);
                map.setView([newLat, newLng], 12);
            }
        }
        map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            updateSearchInputs();
        });
        marker.on('dragend', updateSearchInputs);
        searchLatInput.addEventListener('change', updateSearchMarker);
        searchLngInput.addEventListener('change', updateSearchMarker);
        setTimeout(function() {
            map.invalidateSize();
            console.log('Leaflet: search map resized');
        }, 200);
    }
});