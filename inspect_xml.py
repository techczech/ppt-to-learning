from pptx import Presentation
from pptx.opc.constants import RELATIONSHIP_TYPE as RT

def inspect_xml(path):
    prs = Presentation(path)
    
    # 1. Check if we can access the xml directly
    try:
        xml = prs.element.xml
        print("XML content snippet (first 500 chars):")
        print(xml[:500])
        
        if "sectionLst" in xml:
            print("\nFOUND 'sectionLst' in XML!")
        else:
            print("\n'sectionLst' NOT found in standard XML dump.")
            
    except Exception as e:
        print(f"Error reading element.xml: {e}")

    # 2. Try accessing via the experimental property if it exists hidden
    # In newer python-pptx, it should be prs.sections.
    # If hasattr failed, maybe it's not exposed on the Presentation object directly?
    # Let's check dir(prs)
    print("\nPresentation Attributes:")
    print([d for d in dir(prs) if 'section' in d.lower()])

if __name__ == "__main__":
    inspect_xml("sourcefiles/czech/Czech Images.pptx")

