from sqlalchemy import Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT

# Large text (base64 logo/signature data-URIs). MEDIUMTEXT on MySQL — the
# production column type, unchanged — and plain TEXT anywhere else. A bare
# mysql.MEDIUMTEXT can't be created on the SQLite database the test suite
# uses, which silently stopped every test from running.
LongText = Text().with_variant(MEDIUMTEXT(), "mysql")
