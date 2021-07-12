const db = require('../models/index')



module.exports = {

    /**
     * Options can be:
     * offset - if you don't want the most recent solicitation for *every* test, use this to grab one offset rows back in the list
     * notice_count - Only return a solicitation with exactly notice_count notices matching the solication number
     * has_feedback - Only return a solicitation with feedback
     * has_history - Only return a solicitation with history
     * attachment_count - Only return a solicitation with exactly attachment_count attachments
     *
     * @param options
     * @returns {Promise<*>}
     */
    getSolNumForTesting : async (options = {}) => {
        try {
            let join = " "
            let where = " "
            let offset = ("offset" in options) ? options.offset : 0
            let with_clause = ''


            if ("update_count" in options) {
                let update_count = options['update_count']
                with_clause += ` 
                    with history as (select id, "solNum", jsonb_array_elements(history) as line from solicitations order by id ),
                         history_count as (select "solNum", count(*) from history
                                           where  lower(line->>'action') like 'solicitation updated on%' and "solNum" is not null and "solNum" != ''
                                           group by "solNum" having count(*) > ${update_count}
                         )`
                where += ` and s."solNum" in (select "solNum" from history_count `
            }

            if ("has_feedback" in options) {
                join += ` join survey_responses sr on s."solNum" = sr."solNum" `
                where += ` and s."solNum" in (select distinct "solNum" from survey_responses where jsonb_typeof(response) = 'array' ) `
            }

            if ("has_history" in options) {
                where += ` and  (history is not null) and (history::varchar != '[]') `
            }


            if ("attachment_count" in options) {
                join += ` join (select count(*) as c, solicitation_number from attachment a 
                                join notice n on a.notice_id = n.id 
                                group by solicitation_number having count(*) = ${options.attachment_count}) attachment_counts 
                                on attachment_counts.solicitation_number = s."solNum" `
            }

            let sql = `${with_clause} select s."solNum"
                   from solicitations s 
                            ${join}
                   where ("noticeType" = 'Solicitation' or "noticeType" =  'Combined Synopsis/Solicitation') 
                     and s.active
                     ${where}
                   order by s.date desc
                   limit 1 offset ${offset}`
            let rows = await db.sequelize.query(sql, null);

            expect(rows[0].length).toBeGreaterThan(0)

            return rows[0][0].solNum
        } catch (e) {
            e //?
            return null
        }
    },

    solNumToSolicitationID : async (solNum)=> {
        let sql = `select id from solicitations where "solNum" = ?`
        let rows = await db.sequelize.query(sql, {replacements: [solNum]})
        return rows[0][0].id
    }
}
