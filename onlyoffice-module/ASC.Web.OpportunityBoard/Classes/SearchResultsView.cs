using System;
using System.Web.UI;

using ASC.Common.Utils;
using ASC.Web.Core.ModuleManagement.Common;

namespace ASC.Web.OpportunityBoard.Classes
{
    public sealed class SearchResultsView : ItemSearchControl
    {
        protected override void RenderContents(HtmlTextWriter writer)
        {
            writer.AddAttribute(HtmlTextWriterAttribute.Class, "tableBase");
            writer.AddAttribute("cellspacing", "0");
            writer.AddAttribute("cellpadding", "8");
            writer.RenderBeginTag(HtmlTextWriterTag.Table);
            writer.RenderBeginTag(HtmlTextWriterTag.Tbody);

            foreach (var item in Items.GetRange(0, MaxCount < Items.Count ? MaxCount : Items.Count))
            {
                writer.AddAttribute(HtmlTextWriterAttribute.Class, "search-result-item");
                writer.RenderBeginTag(HtmlTextWriterTag.Tr);
                writer.AddAttribute(HtmlTextWriterAttribute.Class, "borderBase center-column");
                writer.RenderBeginTag(HtmlTextWriterTag.Td);
                if (!string.IsNullOrEmpty(item.URL))
                {
                    writer.AddAttribute(HtmlTextWriterAttribute.Href, item.URL);
                    writer.AddAttribute(HtmlTextWriterAttribute.Class, "link bold");
                    writer.RenderBeginTag(HtmlTextWriterTag.A);
                    writer.Write(HtmlUtil.SearchTextHighlight(Text, item.Name.HtmlEncode()));
                    writer.RenderEndTag();
                }
                else
                {
                    writer.Write(HtmlUtil.SearchTextHighlight(Text, item.Name.HtmlEncode(), true));
                }
                writer.RenderEndTag();
                writer.RenderEndTag();
            }

            writer.RenderEndTag();
            writer.RenderEndTag();
        }
    }
}