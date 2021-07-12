/** @module Time **/

module.exports = {

  formatDateAsString: (date, options = {}) => {

    let zeroPad = ('zeroPad' in options) && options['zeroPad']

    let monthPadding = ( zeroPad && (date.getMonth() + 1) < 10 ) ? "0" : ""
    let dayPadding = (zeroPad && date.getDate() < 10) ? "0" : ""
    return `${monthPadding + (date.getMonth() + 1)}/${dayPadding + date.getDate()}/${date.getFullYear()}`
  }

}
