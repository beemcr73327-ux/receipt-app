function getFormattedThaiDateTime(d) {
  if (!d) d = new Date();
  var dateObj = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dateObj.getTime())) {
    return String(d || '');
  }
  var day = ("0" + dateObj.getDate()).slice(-2);
  var month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
  var year = dateObj.getFullYear();
  if (year < 2500) year += 543;
  var hours = ("0" + dateObj.getHours()).slice(-2);
  var minutes = ("0" + dateObj.getMinutes()).slice(-2);
  var seconds = ("0" + dateObj.getSeconds()).slice(-2);
  return day + "/" + month + "/" + year + " " + hours + ":" + minutes + ":" + seconds;
}

function formatPeriodGAS(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var month = ("0" + (val.getMonth() + 1)).slice(-2);
    var year = val.getFullYear();
    if (year < 2500) year += 543;
    return month + "/" + year;
  }
  var str = String(val).trim();
  if (!str || str === '-') return '';
  var mMatch = str.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (mMatch) {
    var m = ("0" + mMatch[1]).slice(-2);
    var y = mMatch[2].length === 2 ? "25" + mMatch[2] : mMatch[2];
    return m + "/" + y;
  }
  var d = new Date(str);
  if (!isNaN(d.getTime())) {
    var m2 = ("0" + (d.getMonth() + 1)).slice(-2);
    var y2 = d.getFullYear();
    if (y2 < 2500) y2 += 543;
    return m2 + "/" + y2;
  }
  return str;
}

function formatStandardDateGAS(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var day = ("0" + val.getDate()).slice(-2);
    var month = ("0" + (val.getMonth() + 1)).slice(-2);
    var year = val.getFullYear();
    if (year < 2500) year += 543;
    return day + "/" + month + "/" + year;
  }
  var str = String(val).trim();
  if (str.includes('-')) {
    var parts = str.split('-');
    if (parts.length === 3) {
      var y = parseInt(parts[0], 10);
      if (y < 2500) y += 543;
      return ("0" + parts[2]).slice(-2) + "/" + ("0" + parts[1]).slice(-2) + "/" + y;
    }
  }
  return str;
}

function cleanLeadingQuote(val) {
  var str = String(val === null || val === undefined ? '' : val).trim();
  if (str.indexOf("'") === 0) {
    return str.substring(1);
  }
  return str;
}

