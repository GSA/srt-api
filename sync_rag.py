import psycopg2
import json

cloud_conn_string = "postgres://ulalhpz6ndo2wf3c:psd9gn42tmbwe99vtdgzsilgi@localhost:63333/cgawsbrokerproddk4hr1je9kyy3gn"
local_conn_string = "postgres://circleci:srtpass@localhost:5432/SRT"

sol_num = "36C24226Q0439"

print(f"Connecting to Cloud DB to extract RAG data for {sol_num}...")
with psycopg2.connect(cloud_conn_string) as cloud_conn:
    with cloud_conn.cursor() as cloud_cur:
        cloud_cur.execute('SELECT * FROM "rag-solicitations" WHERE "solicitation_number" = %s;', (sol_num,))
        rag_sol = cloud_cur.fetchone()
        
        if not rag_sol:
            print("Solicitation not found in cloud RAG tables.")
            exit(1)
            
        # Get column names for dynamic insertion
        sol_cols = [desc[0] for desc in cloud_cur.description]
        sol_id = rag_sol[sol_cols.index('id')]
        
        cloud_cur.execute('SELECT * FROM "rag-documents" WHERE "solicitation_id" = %s;', (sol_id,))
        rag_docs = cloud_cur.fetchall()
        doc_cols = [desc[0] for desc in cloud_cur.description] if rag_docs else []
        
        doc_ids = tuple([d[0] for d in rag_docs]) if rag_docs else None
        
        rag_matches = []
        rag_ict_types = []
        if doc_ids:
            cloud_cur.execute('SELECT * FROM "rag-vector-matches" WHERE "document_id" IN %s;', (doc_ids,))
            rag_matches = cloud_cur.fetchall()
            match_cols = [desc[0] for desc in cloud_cur.description] if rag_matches else []
            
            cloud_cur.execute('SELECT * FROM "rag-document-ict-types" WHERE "document_id" IN %s;', (doc_ids,))
            rag_ict_types = cloud_cur.fetchall()
            ict_cols = [desc[0] for desc in cloud_cur.description] if rag_ict_types else []

print(f"Found 1 rag-solicitation, {len(rag_docs)} rag-documents, {len(rag_matches)} rag-vector-matches, {len(rag_ict_types)} rag-document-ict-types.")

def generate_insert(table, cols, data):
    cols_str = ", ".join([f'"{c}"' for c in cols])
    places = ", ".join(["%s"] * len(cols))
    return f'INSERT INTO "{table}" ({cols_str}) VALUES ({places}) ON CONFLICT DO NOTHING;'

with psycopg2.connect(local_conn_string) as local_conn:
    with local_conn.cursor() as local_cur:
        print("Inserting into local database...")
        
        local_cur.execute(generate_insert("rag-solicitations", sol_cols, rag_sol), rag_sol)
        
        for doc in rag_docs:
            local_cur.execute(generate_insert("rag-documents", doc_cols, doc), doc)
            
        for match in rag_matches:
            local_cur.execute(generate_insert("rag-vector-matches", match_cols, match), match)
            
        for ict in rag_ict_types:
            local_cur.execute(generate_insert("rag-document-ict-types", ict_cols, ict), ict)
            
    local_conn.commit()
    print("Successfully synchronized RAG data for", sol_num, "to local database!")
