const db = require('../models/index')



module.exports = {

    /**
     * Options can be:
     * offset - if you don't want the most recent solicitation for *every* test, use this to grab one offset rows back in the list
     * notice_count - Only return a solicitation with exactly notice_count notices matching the solication number
     * has_feedback - Only return a solicitation with feedback
     * attachment_count - Only return a solicitation with exactly attachment_count attachments
     *
     * @param options
     * @returns {Promise<*>}
     */
    getSolNumForTesting : async (options = {}) => {
        try {
            let join = " "
            let where = " "
            let offset = ("offset" in options) ? options.offset : 1


            if ("notice_count" in options) {
                join += ` join notice n on n.solicitation_number = p."solNum" `
                where += ` and n.solicitation_number in (select solicitation_number from notice group by solicitation_number having count(*) = ${options.notice_count} ) `
            }

            if ("has_feedback" in options) {
                join += ` join survey_responses sr on p."solNum" = sr."solNum" `
                where += ` and p."solNum" in (select distinct "solNum" from survey_responses where jsonb_typeof(response) = 'array' ) `
            }

            if ("attachment_count" in options) {
                join += ` join (select count(*) as c, solicitation_number from attachment a 
                                join notice n on a.notice_id = n.id 
                                group by solicitation_number having count(*) = ${options.attachment_count}) attachment_counts 
                                on attachment_counts.solicitation_number = p."solNum" `
            }

            let sql = `select p."solNum"
                   from "Predictions" p
                            join solicitations s on p."solNum" = s."solNum"
                            ${join}
                   where "noticeType" = 'Solicitation'
                     and s.active
                     ${where}
                   order by p.date desc
                   limit 1 offset ${offset}`
            let rows = await db.sequelize.query(sql, null);

            expect(rows[0].length).toBeGreaterThan(0)

            return rows[0][0].solNum
        } catch (e) {
            e //?
            e.sql //?
            return null
        }
    }



}
