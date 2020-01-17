/** @module Time **/

module.exports = {

  formatDateAsString: (date) => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  }

}
