const db = require('../models/index')
const logger = require('../config/winston')


module.exports = {

    cleanAwardNotices: async function () {

        try {
            const attachment_sql = `delete
                                    from attachment
                                    where notice_id in
                                          (
                                              select id
                                              from notice n
                                              where n."createdAt" not in
                                                    (select max("createdAt") as latest
                                                     from notice
                                                     where notice.notice_type_id = (select id from notice_type where notice_type = 'Award Notice')
                                                     group by solicitation_number)
                                                and notice_type_id = (select id from notice_type where notice_type = 'Award Notice')
                                          ) `

            const notice_sql_delete = `delete
                                       from notice n
                                       where n."createdAt" not in
                                             (select max("createdAt") as latest
                                              from notice
                                              where notice.notice_type_id = (select id from notice_type where notice_type = 'Award Notice')
                                              group by solicitation_number)
                                         and notice_type_id = (select id from notice_type where notice_type = 'Award Notice')`


            const notice_sql_log = `select solicitation_number, notice_data
                                    from notice n
                                    where n."createdAt" not in
                                          (select max("createdAt") as latest
                                           from notice
                                           where notice.notice_type_id = (select id from notice_type where notice_type = 'Award Notice')
                                           group by solicitation_number)
                                      and notice_type_id = (select id from notice_type where notice_type = 'Award Notice')`

            let rows = await db.sequelize.query(notice_sql_log)
            for (let row of rows[0]) {
                logger.log("info", `Cron process will attempt to delete extra award notice info for ${row.solicitation_number}`, {tag: 'cleanAwardNotices', notice_data: row.notice_data })
            }

            let attachment_result = await db.sequelize.query(attachment_sql)
            logger.log('info', `Deleted ${attachment_result[1].rowCount} attachment records during award notice cleanup`, {tag: 'cleanAwardNotices'})

            let notice_result = await db.sequelize.query(notice_sql_delete)
            logger.log('info', `Deleted ${notice_result[1].rowCount} notice records during award notice cleanup`, {tag: 'cleanAwardNotices'})

            return rows[1].rowCount
        } catch (e) {
            logger.log('error', `Error in cleanAwardNotices`, {tag: 'cleanAwardNotices', error: e})
            return (null)
        }

    }

}
