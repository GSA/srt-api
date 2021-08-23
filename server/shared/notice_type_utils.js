const NoticeType = require('../models').notice_type

let cache = {}

async function getIdForNoticeType (noticeType) {
  if (Array.isArray(noticeType)){
    let ids = []
    for (n of noticeType) {
      ids.push(await getIdForNoticeType(n))
    }
    return ids
  } else {
    let notice = await NoticeType.findOne({where: {notice_type: noticeType}})
    return notice.id
  }
}


module.exports = {
  getIdForNoticeType: getIdForNoticeType
}
