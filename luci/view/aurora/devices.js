'use strict';
'require view';

// AuroraGlass: "Devices" page. The device cards are drawn by the theme script (admin.js),
// which looks for the #aurora-devices container on this page.
return view.extend({
	render: function () {
		return E('div', { 'id': 'aurora-devices' });
	}
});
