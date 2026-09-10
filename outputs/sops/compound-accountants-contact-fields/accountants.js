/* Compound – Accountants landing page. Behaviour ported 1:1 from the design's component logic. */
(function () {
  'use strict';
  var L = window.CompoundLPCore;
  var lists = (window.CompoundLP && window.CompoundLP.lists) || {};

  L.mount(document.getElementById('compound-lp'), {
    state: { practice: '', email: '', phone: '', band: '', software: '', slot: '', booked: false, error: '', openFaq: -1, scrolled: false },

    mount: function (api) {
      L.watchScrolled(api);
    },

    vals: function (api) {
      var s = api.state, refs = api.refs, set = api.setState;

      function pillSet(items, key) {
        return items.map(function (it) {
          var label = it.label, on = s[key] === label;
          return {
            label: label,
            pick: function () { var p = { error: '' }; p[key] = label; set(p); },
            bg: on ? '#0A0A0A' : '#fff',
            color: on ? '#fff' : '#0A0A0A',
            border: on ? '1.5px solid #0A0A0A' : '1.5px solid #DCDCDC'
          };
        });
      }

      return {
        faqs: L.faqItems(api, lists.faqs),
        painPanels: lists.painPanels || [],
        practice: s.practice,
        onPractice: function (e) { set({ practice: e.target.value, error: '' }); },
        email: s.email,
        onEmail: function (e) { set({ email: e.target.value, error: '' }); },
        phone: s.phone,
        onPhone: function (e) { set({ phone: e.target.value, error: '' }); },
        bands: pillSet(lists.bands || [], 'band'),
        softwares: pillSet(lists.softwares || [], 'software'),
        slots: (lists.slots || []).map(function (it) {
          var label = it.label, on = s.slot === label;
          return {
            label: label,
            pick: function () { set({ slot: label, error: '' }); },
            bg: on ? 'linear-gradient(135deg,#C400D7,#6C1AF9)' : '#fff',
            color: on ? '#fff' : '#0A0A0A',
            border: on ? '1.5px solid transparent' : '1.5px solid #DCDCDC'
          };
        }),
        notBooked: !s.booked,
        isBooked: s.booked,
        bookError: s.error,
        confirmBooking: function () {
          if (!s.practice.trim()) { return set({ error: 'Add your practice name so we can prep properly.' }); }
          if (!s.email.trim()) { return set({ error: 'We need a work email so we can send the invite.' }); }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) { return set({ error: 'That email doesn’t look quite right.' }); }
          // Phone is optional. Only validate it when something has been typed.
          if (s.phone.trim() && s.phone.replace(/\D/g, '').length < 10) { return set({ error: 'That phone number doesn’t look quite right, or you can leave it blank.' }); }
          if (!s.band) { return set({ error: 'Pick a client-count band — it shapes the demo.' }); }
          if (!s.software) { return set({ error: 'Tell us your payroll software so the demo matches your stack.' }); }
          if (!s.slot) { return set({ error: 'Pick a slot that suits you.' }); }
          L.submit('accountants', {
            practice: s.practice,
            // Trimmed at source: a stray space survives all the way into the
            // CRM and, once hashed for the Conversions API, silently fails to
            // match the browser-side hash.
            email: s.email.trim(),
            phone: s.phone.trim(),
            clients: s.band,
            software: s.software,
            slot: s.slot
          });
          set({ booked: true, error: '' });
        },
        bookedBand: s.band,
        bookedSoftware: s.software,
        bookedSlot: s.slot,
        goBooking: function () { L.scrollToEl(refs.bookingRef); },
        goFree: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); },
        showSticky: s.scrolled && !s.booked
      };
    }
  });
})();
